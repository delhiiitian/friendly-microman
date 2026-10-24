// Share codes round-trip, and a crafted project cannot inject code through numbers or names.
// Run: node tests/projects.test.js
const FM = require('./load.js')();
let failed = 0;
const fail = (m) => { failed++; console.error('FAIL', m); };

(async () => {
  const t = FM.templates[0];
  const board = FM.boards.pi5;
  const r = FM.loadTemplate(t, board);
  r.program.net.pass = 'secret-wifi'; r.program.net.token = '123:secret';
  const S = { board: 'pi5', lang: null, build: r.build, program: r.program, title: r.title, codeEdited: false, code: '' };

  const shared = FM.projects.pack(S, { share: true });
  if (shared.program.net.pass || shared.program.net.token) fail('share code must not carry secrets');
  if (!S.program.net.token) fail('packing must not change the open project');
  const code = await FM.projects.encode(shared);
  if (!/^fm[01]\.[\w-]+$/.test(code)) fail('share code format: ' + code.slice(0, 20));
  const back = await FM.projects.decode('https://example.com/app/#share=' + code);
  const g1 = FM.generate(board, S.build, JSON.parse(JSON.stringify(S.program)), { title: S.title }).code;
  const g2 = FM.generate(FM.boards[back.board], back.build, back.program, { title: back.title }).code;
  if (g1 !== g2) fail('shared project generates different code');
  const fromFile = await FM.projects.decode(FM.projects.fileText(shared));
  if (fromFile.build.length !== S.build.length) fail('project file round trip');

  // A crafted project
  const evil = {
    board: 'pi5', title: 'x', build: [{ uid: 'u1', id: 'bme280' }, { uid: 'bad"uid', id: 'led' }, { uid: 'u3', id: 'nope' }],
    program: {
      mode: 'loop', interval: '5\nimport os; os.system("rm -rf ~")',
      reads: [{ uid: 'u1', k: 'temperature', name: 'temp"]; os.system("x"); #' }],
      steps: [{ t: 'limit', key: 'temp', op: '> 0 or __import__("os").system("x") or', val: '1; evil()' }],
      actions: [{ uid: 'print', act: 'print', when: 'always', every: '0)\nos.system("x")#', msg: 'hi " + os.system("x") + "' }],
      net: { broker: 'b"; os.system("x"); "', port: '80; evil' },
    },
  };
  const p = await FM.projects.decode(JSON.stringify(evil));
  if (p.build.length !== 1) fail('bad parts should be dropped');
  if (p.program.interval !== 5) fail('interval should fall back to 5');
  if (/[^\w]/.test(p.program.reads[0].name)) fail('read names must be identifiers');
  if (p.program.steps[0].op != null) fail('unknown operator must be dropped');
  if (p.program.steps[0].val !== null) fail('non-numbers must be dropped');
  const out = FM.generate(FM.boards.pi5, p.build, p.program, { title: p.title }, 'python').code;
  if (/os\.system|evil\(|__import__/.test(out.replace(/"(?:\\.|[^"\\])*"/g, '""'))) fail('crafted project leaked code outside a string:\n' + out);
  const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fmp-')), 'evil.py');
  fs.writeFileSync(f, out);
  try { execFileSync('python3', ['-m', 'py_compile', f], { stdio: 'pipe' }); } catch (e) { fail('crafted project code does not compile: ' + e.stderr); }

  let threw = false;
  try { await FM.projects.decode('hello'); } catch (e) { threw = true; }
  if (!threw) fail('random text should be refused');

  console.log('projects', failed ? failed + ' failures' : 'ok');
  process.exit(failed ? 1 : 0);
})();
