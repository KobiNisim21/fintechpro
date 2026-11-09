import { zipSync, strToU8 } from 'fflate';

const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
const column = index => { let result = ''; for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result; return result; };

// Minimal OOXML: explicit numeric and inline-string cells; user text is never a formula.
export function createExcelWorkbook(sheets) {
    if (sheets.some(sheet => sheet.rows.some(row => row.some(value => String(value ?? '').length > 32767)))) throw new Error('An export cell exceeds the Excel text limit');
    const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const files = {};
    const put = (name, content) => { files[name] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + content); };
    put('[Content_Types].xml', `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
    put('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    put('xl/workbook.xml', `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, i) => `<sheet name="${xml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
    put('xl/_rels/workbook.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`);
    sheets.forEach((sheet, i) => put(`xl/worksheets/sheet${i + 1}.xml`, `<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${(sheet.rows[0] || []).map((_, columnIndex) => `<col min="${columnIndex + 1}" max="${columnIndex + 1}" width="${Math.min(60, Math.max(14, ...sheet.rows.slice(0, 1000).map(row => String(row[columnIndex] ?? '').length + 2)))}" customWidth="1"/>`).join('')}</cols><sheetData>${sheet.rows.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => { const ref = column(c) + (r + 1); return typeof value === 'number' && Number.isFinite(value) ? `<c r="${ref}"><v>${value}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`; }).join('')}</row>`).join('')}</sheetData></worksheet>`));
    return Buffer.from(zipSync(files));
}
