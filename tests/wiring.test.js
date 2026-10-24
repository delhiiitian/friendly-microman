// Wiring checker: right wires pass, mistakes are caught with the right severity,
// and "use my wiring" moves the part in the plan and in the code.
// Run: node tests/wiring.test.js
const FM = require('./load.js')();
let failed = 0;
const fail = (m) => { failed++; console.error('FAIL', m); };

FM.boardOrder.forEach((bid) => {
  const board = FM.boards[bid];
  const build = [{ uid: 'c', id: board.family === 'arduino' ? 'bme280' : 'scd40' }, { uid: 'l', id: 'led' }, { uid: 'd', id: 'dht22' }];
  const A = FM.allocate(board, build);
  const co2 = A.byUid.c, led = A.byUid.l;
  const plan = (i) => Object.assign({}, i.pins);
  const sig = (i, k) => i.def.sig.findIndex((s) => s.k === k);

  let r = FM.checkWiring(A, co2, plan(co2));
  if (r.worst !== 'ok') fail(bid + ': the plan itself should pass, got ' + r.worst + ' ' + JSON.stringify(r.rows.filter((x) => x.level !== 'ok')));

  const sw = plan(co2); const a = sig(co2, 'sda'), b = sig(co2, 'scl'); [sw[a], sw[b]] = [sw[b], sw[a]];
  r = FM.checkWiring(A, co2, sw);
  if (!r.rows.some((x) => x.level === 'bad' && /swapped/.test(x.msg))) fail(bid + ': swapped SDA/SCL not caught');

  const rev = plan(co2); rev[co2.def.sig.findIndex((s) => ['vcc', 'v3', 'v5'].includes(s.k))] = board.power.gnd[0];
  r = FM.checkWiring(A, co2, rev);
  if (r.worst !== 'danger') fail(bid + ': power on GND should be danger');

  const half = plan(co2); delete half[sig(co2, 'scl')];
  if (FM.checkWiring(A, co2, half).worst !== 'todo') fail(bid + ': missing wire should be todo');

  // the LED on another free pin: fine, and the code can follow it
  const ledIdx = sig(led, 'gpio') >= 0 ? sig(led, 'gpio') : sig(led, 'pwm');
  const other = A.free[0];
  const moved = plan(led); moved[ledIdx] = other;
  r = FM.checkWiring(A, led, moved);
  if (!r.canFollow) fail(bid + ': LED on free pin ' + other + ' should be followable: ' + JSON.stringify(r.rows));
  const build2 = build.map((x) => (x.uid === 'l' ? Object.assign({}, x, { pins: FM.followWiring(r) }) : x));
  const A2 = FM.allocate(board, build2);
  if (A2.byUid.l.pins[ledIdx] !== other) fail(bid + ': planner ignored the chosen pin');
  if (FM.checkWiring(A2, A2.byUid.l, moved).worst !== 'ok') fail(bid + ': after following, the wiring should be right');
  const dhtPin = A.byUid.d.pins[sig(A.byUid.d, 'gpio')];
  const clash = plan(led); clash[ledIdx] = dhtPin;
  if (FM.checkWiring(A, led, clash).worst !== 'bad') fail(bid + ': LED on the DHT pin should be bad');
});

console.log('wiring', failed ? failed + ' failures' : 'ok');
process.exit(failed ? 1 : 0);
