import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..');
const chunks = JSON.parse(
  fs.readFileSync(path.join(dir, '_forum-fill-meest-cdp-chunks.json'), 'utf8')
);
const outDir = path.join(dir, '_forum-cdp-expr');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'init.txt'), "window.__CDP=''; 'init'");
chunks.forEach((c, i) => {
  const expr = `window.__CDP=(window.__CDP||"")+${JSON.stringify(c)}; "c${i}"`;
  fs.writeFileSync(path.join(outDir, `chunk-${String(i).padStart(2, '0')}.txt`), expr);
});
fs.writeFileSync(
  path.join(outDir, 'final.txt'),
  '(() => { const r = eval(window.__CDP); return typeof r === "string" ? r : JSON.stringify(r); })()'
);
console.log(`expr_files ${chunks.length + 2}`);
