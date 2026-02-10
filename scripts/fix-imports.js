const fs = require('fs');
const path = require('path');

const uiDir = path.join(__dirname, '../src/components/ui');

fs.readdir(uiDir, (err, files) => {
    if (err) {
        console.error('Could not list directory', err);
        process.exit(1);
    }

    files.forEach(file => {
        if (!file.endsWith('.tsx') && !file.endsWith('.ts')) return;

        const filePath = path.join(uiDir, file);
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) return console.error('Error reading file', file, err);

            let newData = data;

            // Fix versioned imports: quote("package@version") -> quote("package")
            // Regex looks for "package-name@1.2.3"
            // avoiding capturing existing correct imports
            newData = newData.replace(/from "([^"]+)@[\d\.]+"/g, 'from "$1"');

            // Specifically fix lucide-react imports if they use the Icon suffix scheme
            // Pattern: import { XIcon } from "lucide-react"
            // We want: import { X as XIcon } from "lucide-react"
            // But only if XIcon is not actually exported (which it isn't in v0.4+)

            // Find lucide-react imports
            // capture the imports content
            // This is a naive regex, assumes simple imports
            newData = newData.replace(/import {([^}]+)} from "lucide-react"/g, (match, importsBody) => {
                const imports = importsBody.split(',').map(i => i.trim());
                const newImports = imports.map(imp => {
                    // if import is like "XIcon", change to "X as XIcon"
                    // if import is "Loader2", keep it "Loader2" (some don't have Icon suffix)
                    // But how to know? standard Lucide naming:
                    // If it ends in Icon, likely we need to alias it: NameIcon -> Name as NameIcon
                    if (imp.endsWith('Icon')) {
                        const baseName = imp.replace(/Icon$/, '');
                        // Check if baseName is empty? (unlikely)
                        return `${baseName} as ${imp}`;
                    }
                    return imp;
                });
                return `import { ${newImports.join(', ')} } from "lucide-react"`;
            });

            if (newData !== data) {
                fs.writeFile(filePath, newData, 'utf8', (err) => {
                    if (err) console.error('Error writing file', file, err);
                    else console.log(`Fixed imports in ${file}`);
                });
            }
        });
    });
});
