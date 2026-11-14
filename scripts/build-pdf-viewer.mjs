/**
 * Builds assets/pdf/viewer.html: src/features/pdf/viewer/template.html with pdf.js (legacy
 * build) and its worker inlined, so the PDF reader works offline from one bundled file.
 * Run after changing the template or upgrading pdfjs-dist: `npm run pdf-viewer`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
// Inline scripts must not close their own tag.
const safe = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

const template = read('src/features/pdf/viewer/template.html');
const lib = safe(read('node_modules/pdfjs-dist/legacy/build/pdf.min.js'));
const worker = safe(read('node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js'));

const html = template.replace('/*PDFJS*/', () => lib).replace('/*WORKER*/', () => worker);
writeFileSync(join(root, 'assets/pdf/viewer.html'), html);
console.log(`assets/pdf/viewer.html: ${(html.length / 1024).toFixed(0)} KB`);
