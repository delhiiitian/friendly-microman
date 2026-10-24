// Every lesson can be finished: doing what each step says makes its check pass.
// Run: node tests/lessons.test.js
const FM = require('./load.js')();
let failed = 0;
const fail = (m) => { failed++; console.error('FAIL', m); };

// What a learner does, step by step, as changes to the project.
const SOLVE = {
  blink: [(p) => p.part('led'), (p) => { p.flags.wireChecked = true; }, (p) => p.act('led', 'blink'), (p) => { p.sim.running = true; }, null],
  temperature: [(p) => p.part('dht22'), (p) => p.read('dht22', 'temperature'), (p) => p.out('print'), (p) => { p.prog.actions[0].msg = 'It is {temperature} degrees'; }, (p) => { p.sim.running = true; p.sim.touched = true; }],
  'co2-alarm': [(p) => p.part('scd40'), (p) => p.read('scd40', 'co2'), (p) => p.prog.steps.push({ t: 'limit', key: 'co2', op: '>', val: 1000 }), (p) => { p.part('buzzer'); p.act('buzzer', 'beep'); }, (p) => { p.sim.running = true; p.sim.alert = true; }],
  'gyro-x': [(p) => p.part('mpu6050'), (p) => p.read('mpu6050', 'ax'), (p) => p.prog.steps.push({ t: 'math', target: 'x', a: 'ax', op: '/', b: 9.81 }), (p) => { p.out('print'); p.prog.actions[0].msg = 'x axis is {x}'; }, (p) => { p.sim.running = true; p.sim.touched = true; }],
  talk: [(p) => p.part('usbspk'), (p) => p.prog.reads.push({ uid: 'sys', k: 'cpu_temp', name: 'cpu_temp' }), (p) => p.act('usbspk', 'say'), (p) => { p.sim.running = true; }],
  'graph-share': [(p) => p.prog.reads.push({ uid: 'sys', k: 'uptime', name: 'uptime' }), (p) => p.out('plot'), (p) => { p.sim.running = true; p.sim.plot = { order: ['uptime'], data: { uptime: [1, 2, 3, 4, 5] } }; }, (p) => { p.flags.saved = true; }, null],
};

FM.lessons.forEach((l) => {
  const steps = SOLVE[l.id];
  if (!steps || steps.length !== l.steps.length) return fail(l.id + ': no solution written for every step');
  const board = FM.boards[l.family === 'pi' || !l.family ? 'pi5' : FM.boardOrder.find((b) => FM.boards[b].family === l.family)];
  const S = { build: [], program: FM.newProgram() };
  const sim = { running: false, touched: false, alert: false, plot: { order: [], data: {} } };
  const flags = {};
  const uidOf = (id) => S.build.find((b) => b.id === id).uid;
  const p = {
    prog: S.program, sim, flags,
    part: (id) => S.build.push({ uid: id + S.build.length, id }),
    read: (id, k) => S.program.reads.push({ uid: uidOf(id), k, name: k }),
    act: (id, act) => S.program.actions.push({ id: 'a' + S.program.actions.length, uid: uidOf(id), act, when: 'always', every: 0, msg: '' }),
    out: (uid) => S.program.actions.push({ id: 'o' + S.program.actions.length, uid, act: uid, when: 'always', every: 0, msg: '' }),
  };
  steps.forEach((solve, k) => {
    const s = l.steps[k];
    if (s.manual) { if (solve) fail(l.id + ' step ' + (k + 1) + ' is manual'); return; }
    const A = FM.allocate(board, S.build);
    if (s.check(FM.lessonContext(S, A, sim, flags))) fail(l.id + ' step ' + (k + 1) + ' passes before it is done');
    solve(p);
    const A2 = FM.allocate(board, S.build);
    if (!s.check(FM.lessonContext(S, A2, sim, flags))) fail(l.id + ' step ' + (k + 1) + ' does not pass after doing it: ' + s.text);
  });
});

console.log('lessons', failed ? failed + ' failures' : 'ok');
process.exit(failed ? 1 : 0);
