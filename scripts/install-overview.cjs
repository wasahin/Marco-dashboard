const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'index.html');
const tag = '<script id="market-overview-loader" src="src/market-overview.js" defer></script>';
const html = fs.readFileSync(file, 'utf8');
if (!html.includes('id="market-overview-loader"')) {
  if (!/<\/body>/i.test(html)) throw new Error('Missing body: refusing to modify HTML');
  fs.writeFileSync(file, html.replace(/<\/body>/i, tag + '\n</body>'));
  console.log('Market overview mounted; existing dashboard preserved.');
}
