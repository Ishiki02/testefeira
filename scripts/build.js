const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'public'), { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'community.js']) {
  fs.copyFileSync(path.join(root, file), path.join(root, 'public', file));
}
console.log('Frontend pronto em public/');
