const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');
const loaders = [
  ['market-overview-loader', 'src/market-overview.js'],
  ['hedge-fund-loader', 'src/hedge-fund-exposure.js']
];
let changed = false;
for (const [id, src] of loaders) {
  if (html.includes(`id="${id}"`)) continue;
  if (!/<\/body>/i.test(html)) throw new Error('Missing body: refusing to modify HTML');
  html = html.replace(/<\/body>/i, `<script id="${id}" src="${src}" defer></script>\n</body>`);
  changed = true;
}
if (changed) fs.writeFileSync(file, html);
