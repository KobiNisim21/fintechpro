
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '../server/services/stockDataService.js');

try {
    const code = fs.readFileSync(filePath, 'utf8');
    // Basic syntax check using eval wrapper (vm.Script)
    new vm.Script(code);
    console.log('Syntax OK');
} catch (e) {
    console.error('Syntax Error:', e.message);
    if (e.loc) console.error('Location:', e.loc);
    console.error(e.stack.split('\n')[0]);
}
