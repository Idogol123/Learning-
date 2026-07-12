// Build the self-contained file-search app from template.html + inlined libraries.
// Usage:  cd src && npm install && node build.mjs
// Outputs ../file-search.html and ../index.html (identical; index.html is what
// GitHub Pages serves at the site root).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));   // the src/ folder
const REPO = path.resolve(DIR, '..');
const read = (p) => fs.readFileSync(p, 'utf8');
const nm = (p) => path.join(DIR, 'node_modules', p);

// Prevent a stray </script> inside minified lib text from closing our tag.
const safe = (code) => code.replace(/<\/script/gi, '<\\/script');

const xlsx = safe(read(nm('xlsx/dist/xlsx.full.min.js')));
const mammoth = safe(read(nm('mammoth/mammoth.browser.min.js')));
const pdf = safe(read(nm('pdfjs-dist/build/pdf.min.js')));

// PDF worker embedded as a base64 data: URI (avoids any </script> escaping issues).
const workerB64 = fs.readFileSync(nm('pdfjs-dist/build/pdf.worker.min.js')).toString('base64');
const workerScript =
  '<script>window.PDF_WORKER_DATA_URI="data:text/javascript;base64,' + workerB64 + '";</script>';

const block = [
  '  <!-- Bundled libraries (inlined so the app works fully offline) -->',
  workerScript,
  '  <script>' + xlsx + '</script>',
  '  <script>' + mammoth + '</script>',
  '  <script>' + pdf + '</script>'
].join('\n');

let template = read(path.join(DIR, 'template.html'));

// Inject the home-screen icon as a data: URI (keeps the file self-contained).
const iconB64 = fs.readFileSync(path.join(DIR, 'icon.png')).toString('base64');
template = template.split('<!--ICON-->').join('data:image/png;base64,' + iconB64);

if (!template.includes('<!--LIBS-->')) throw new Error('placeholder <!--LIBS--> not found');
// Use a replacement FUNCTION so `$`-sequences inside the minified library
// code (e.g. `$&`, `$'`) are inserted literally rather than interpreted.
const finalHtml = template.replace('<!--LIBS-->', () => block);

for (const name of ['file-search.html', 'index.html']) {
  fs.writeFileSync(path.join(REPO, name), finalHtml);
}
console.log('Wrote file-search.html and index.html (' +
  (Buffer.byteLength(finalHtml) / 1024).toFixed(0) + ' KB each)');
