// Bundles index.html, the CSS and every script into one self-contained HTML file.
// Usage: node tools/build-single.js out.html [--fragment]
// --fragment leaves out <html>/<head>/<body>, for hosts that add their own page skeleton.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const [out, flag] = process.argv.slice(2);
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (m, f) => '<style>\n' + fs.readFileSync(path.join(ROOT, f), 'utf8') + '</style>');
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => '<script>\n' + fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>');
if (flag === '--fragment') {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
  const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  html = head.trim() + '\n' + body.trim() + '\n';
}
fs.writeFileSync(out || path.join(ROOT, 'friendly-microman.html'), html);
console.log('wrote', out, Math.round(html.length / 1024), 'KB');
