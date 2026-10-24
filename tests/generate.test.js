// Generates every starter project for every board and language, then checks
// that Python/MicroPython code compiles and Arduino code has balanced braces.
// Run: node tests/generate.test.js
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const FM = require('./load.js')();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-'));
let checked = 0, failed = 0;
function fail(msg) { failed++; console.error('FAIL', msg); }

function check(boardId, lang, title, code) {
  checked++;
  if (lang === 'arduino') {
    const stripped = code.replace(/"(\\.|[^"\\])*"/g, '""').replace(/'(\\.|[^'\\])'/g, "''").replace(/\/\/.*$/gm, '');
    let depth = 0;
    for (const ch of stripped) { if (ch === '{') depth++; if (ch === '}') depth--; if (depth < 0) break; }
    if (depth !== 0) fail(boardId + ' ' + lang + ' ' + title + ': unbalanced braces');
    // Syntax-check with g++ against small stand-ins for the Arduino core and libraries.
    const cpp = path.join(tmp, boardId + '_' + title.replace(/\W+/g, '_') + '.cpp');
    fs.writeFileSync(cpp, '#include "Arduino.h"\n' + code);
    try { execFileSync('g++', ['-std=c++17', '-fsyntax-only', '-Wno-unused-value', '-I', path.join(__dirname, 'arduino-stubs'), cpp], { stdio: 'pipe' }); }
    catch (e) { fail(boardId + ' arduino ' + title + ':\n' + e.stderr.toString().split('\n').slice(0, 8).join('\n')); }
    if (/undefined|NaN|\[object/.test(code)) fail(boardId + ' ' + lang + ' ' + title + ': contains undefined/NaN');
    return;
  }
  const f = path.join(tmp, boardId + '_' + lang + '_' + title.replace(/\W+/g, '_') + '.py');
  fs.writeFileSync(f, code);
  try { execFileSync('python3', ['-m', 'py_compile', f], { stdio: 'pipe' }); }
  catch (e) { fail(boardId + ' ' + lang + ' ' + title + ':\n' + e.stderr.toString()); }
  if (/undefined|\[object|Pin\(\?\)|\(\?\)/.test(code)) fail(boardId + ' ' + lang + ' ' + title + ': contains undefined or a missing pin');
}

FM.boardOrder.forEach((bid) => {
  const board = FM.boards[bid];
  FM.langsFor(board).forEach((lang) => {
    FM.templates.forEach((t) => {
      if (t.family && t.family !== board.family) return;
      const { build, program, title } = FM.loadTemplate(t, board);
      const out = FM.generate(board, build, program, { title }, lang);
      check(bid, lang, title, out.code);
    });
    // Every part on its own, with all of its values read and all actions used.
    FM.partOrder.forEach((pid) => {
      const part = FM.parts[pid];
      if (!part.families.includes(board.family) || part.nocode) return;
      const build = [{ uid: 'x1', id: pid }];
      const program = FM.newProgram();
      part.values.filter((v) => !v.text).forEach((v) => program.reads.push({ uid: 'x1', k: v.k, name: FM.uniqueName(program, v.k) }));
      if (program.reads.length) program.steps.push({ t: 'limit', key: program.reads[0].name, op: '>', val: 10 }, { t: 'math', target: 'calc', a: program.reads[0].name, op: 'map', b: 0, b2: 100, c1: 0, c2: 1 });
      (part.actions || []).forEach((a, k) => program.actions.push({ id: 'a' + k, uid: 'x1', act: a.k, when: 'alert', every: 5, msg: 'value {calc}', key: program.reads[0] ? program.reads[0].name : 'uptime', angle: 90, colour: '#ff8800' }));
      program.actions.push({ id: 'p', uid: 'print', act: 'print', when: 'always', every: 0, msg: 'hi' });
      const out = FM.generate(board, build, program, { title: pid }, lang);
      check(bid, lang, 'part ' + pid, out.code);
    });
  });
});

// Pin planner sanity: nothing exclusive is double-booked.
FM.boardOrder.forEach((bid) => {
  const board = FM.boards[bid];
  const build = ['scd40', 'bme280', 'bme280', 'oled', 'dht22', 'led', 'button', 'servo', 'relay', 'pir', 'ds18b20', 'ds18b20']
    .filter((id) => FM.parts[id].families.includes(board.family)).map((id, k) => ({ uid: 'b' + k, id }));
  const A = FM.allocate(board, build);
  Object.entries(A.use).forEach(([pin, users]) => {
    const p = board.pins[pin];
    const sharedOk = ['v3', 'v5', 'gnd', 'i2c'].includes(p.type) || users.every((u) => /SDA|SCL|DATA/.test(u.devPin) || u.mirror) ;
    const owners = new Set(users.map((u) => u.uid));
    if (owners.size > 1 && !sharedOk) fail(bid + ': pin ' + pin + ' shared by ' + users.map((u) => u.label + ':' + u.devPin).join(', '));
  });
  const bmes = A.inst.filter((i) => i.def.id === 'bme280');
  if (bmes.length === 2 && bmes[0].addr === bmes[1].addr) fail(bid + ': two BME280 on the same address');
});

console.log('checked', checked, 'programs;', failed ? failed + ' failures' : 'all passed');
process.exit(failed ? 1 : 0);
