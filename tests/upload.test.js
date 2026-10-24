// Checks the MicroPython raw-REPL upload: a fake board records what the browser sends,
// then real Python replays it and we compare the saved main.py with the original code.
// Run: node tests/upload.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ctx = { window: {}, console, navigator: {}, TextEncoder, TextDecoder, setTimeout, clearTimeout, Date };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/core.js', 'js/serial.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
const S = ctx.FM.serial;

const statements = [];
let pending = '';
let raw = false;
const dec = new TextDecoder();
S.writer = {};
S.write = async (data) => {
  const text = typeof data === 'string' ? data : dec.decode(data);
  for (const ch of text) {
    if (ch === '\x01') { raw = true; S.buffer += 'raw REPL; CTRL-B to exit\r\n>'; continue; }
    if (ch === '\x02') { raw = false; continue; }
    if (ch === '\x03') continue;
    if (ch === '\x04') { if (raw) { statements.push(pending); pending = ''; S.buffer += 'OK\x04\x04>'; } continue; }
    if (raw) pending += ch;
  }
};

const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'gen', 'micropython.js'), 'utf8').slice(0, 5000) + '\n# ünïcødé ✓ \\ \' " \t end\n';
(async () => {
  await S.uploadMicroPython(code, 'main.py');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fmup-'));
  fs.writeFileSync(path.join(dir, 'replay.py'), statements.join('\n') + '\n');
  execFileSync('python3', ['replay.py'], { cwd: dir });
  const saved = fs.readFileSync(path.join(dir, 'main.py'), 'utf8');
  if (saved !== code) { console.error('FAIL: saved file differs'); process.exit(1); }
  console.log('upload ok:', statements.length, 'raw REPL statements,', Buffer.byteLength(code), 'bytes');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
