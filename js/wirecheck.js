/* Wiring checker. You tell it which board pin each wire of a part really goes to,
   and it says, wire by wire, whether that is right, fine but different from the plan,
   or a mistake (and how bad: a swapped SDA/SCL just will not work, while power on a
   ground pin can destroy the part). Pure functions, so the tests can run them. */
(function () {
  const POWER = ['v3', 'v5', 'vin'];

  // inst: an instance from FM.allocate; chosen: { sigIndex: boardPinId }
  FM.checkWiring = function (A, inst, chosen) {
    const board = A.board;
    const def = inst.def;
    const out = [];
    const seen = {};
    const ref = (id) => FM.pinRef(board, id);
    const powered = def.sig.some((x) => ['vcc', 'v3', 'v5'].includes(x.k)); // has a chip that reversed power can damage
    def.sig.forEach((s, idx) => {
      if (s.k === 'none') return;
      const plan = inst.pins[idx];
      if (plan == null) return; // goes to another module (e.g. through an ADS1115)
      const c = chosen[idx];
      const r = { idx, devPin: s.p, plan, chosen: c || null };
      out.push(r);
      if (!c) { r.level = 'todo'; r.msg = 'Not connected yet. The plan says ' + ref(plan) + '.'; return; }
      const p = board.pins[c];
      if (!p) { r.level = 'bad'; r.msg = 'That pin does not exist on ' + board.short + '.'; return; }
      const rail = s.k === 'vcc' ? (board.logic === 5 ? 'v5' : 'v3') : s.k;
      const isSignal = !['v3', 'v5', 'gnd'].includes(rail);
      if (isSignal && !POWER.includes(p.type) && p.type !== 'gnd') {
        if (seen[c] != null) { r.level = 'bad'; r.msg = 'Two wires of this part are on ' + ref(c) + '. Each signal needs its own pin.'; return; }
        seen[c] = idx;
      }
      if (c === plan) { r.level = 'ok'; r.msg = ''; return; }

      // ---- power and ground ----
      if (rail === 'gnd') {
        if (p.type === 'gnd') { r.level = 'ok'; r.msg = 'Any GND pin works.'; return; }
        if (POWER.includes(p.type)) {
          if (!powered) { r.level = 'bad'; r.msg = 'GND is on a power pin, so it will not work. It goes to ' + ref(plan) + '.'; return; }
          r.level = 'danger'; r.msg = 'Ground is on a power pin, so the part gets power the wrong way round. This can destroy it. Unplug before you continue.'; return;
        }
        r.level = 'bad'; r.msg = 'GND must go to a GND pin, for example ' + ref(plan) + '.'; return;
      }
      if (rail === 'v3' || rail === 'v5') {
        if (p.type === 'gnd') { r.level = 'danger'; r.msg = 'Power is on a GND pin, so the part gets power the wrong way round. This can destroy it.'; return; }
        if (p.type === rail) { r.level = 'ok'; r.msg = 'Any ' + (rail === 'v3' ? '3.3 V' : '5 V') + ' pin works.'; return; }
        if (p.type === 'v5' && rail === 'v3') {
          if (def.only33) { r.level = 'danger'; r.msg = 'This part is 3.3 V only. 5 V can destroy it. Move the wire to ' + ref(plan) + '.'; return; }
          r.level = 'warn'; r.msg = 'Works for this part, but then its signal wires may send 5 V into the ' + board.short + ', which expects 3.3 V. Use ' + ref(plan) + '.'; return;
        }
        if (p.type === 'v3' && rail === 'v5') { r.level = 'warn'; r.msg = 'This part wants 5 V. On 3.3 V it may not work or read wrong. Use ' + ref(plan) + '.'; return; }
        if (p.type === 'vin') { r.level = 'warn'; r.msg = 'VIN carries whatever powers the board, which can be more than the part takes. Use ' + ref(plan) + '.'; return; }
        r.level = 'bad'; r.msg = 'Power must go to a power pin: ' + ref(plan) + '.'; return;
      }

      // ---- signals ----
      if (POWER.includes(p.type)) { r.level = 'danger'; r.msg = 'A signal wire on a power pin. Move it before you power up, or the part or the board can be damaged.'; return; }
      if (p.type === 'gnd') { r.level = 'bad'; r.msg = 'A signal wire on GND will not work. It goes to ' + ref(plan) + '.'; return; }
      if (board.avoid && board.avoid[c]) { r.level = 'bad'; r.msg = ref(c) + ' is reserved: ' + board.avoid[c]; return; }
      const other = (A.use[c] || []).filter((u) => u.uid !== inst.uid && !u.mirror);
      const sharedBus = ['sda', 'scl', 'mosi', 'miso', 'sck', 'w1'].includes(s.k);
      if (other.length && !sharedBus) { r.level = 'bad'; r.msg = ref(c) + ' is already used by ' + other.map((u) => u.label).join(', ') + '.'; return; }
      const pair = { sda: 'scl', scl: 'sda', tx: 'rx', rx: 'tx' }[s.k];
      if (pair) {
        const pIdx = def.sig.findIndex((x) => x.k === pair);
        if (pIdx >= 0 && inst.pins[pIdx] === c) {
          r.level = 'bad';
          r.msg = s.k === 'sda' || s.k === 'scl' ? 'SDA and SCL are swapped. Swap these two wires.' : 'TX and RX need to cross: the part’s TX goes to the board’s RX. Swap these two wires.';
          return;
        }
      }
      if (['sda', 'scl', 'mosi', 'miso', 'sck', 'tx', 'rx', 'i2s_bclk', 'i2s_ws', 'i2s_din'].includes(s.k)) {
        r.level = 'bad'; r.msg = 'This wire has to go to the bus pin ' + ref(plan) + '.'; return;
      }
      // a plain pin that would also work: the code can follow the wire
      if (s.k === 'adc') {
        const slot = (board.adc || []).find((a) => a.pin === c);
        if (slot) { r.level = 'moved'; r.msg = 'Works too: ' + ref(c) + ' can read analog. The code expects ' + ref(plan) + '.'; return; }
        r.level = 'bad'; r.msg = ref(c) + ' cannot read analog values. Use ' + ref(plan) + '.'; return;
      }
      if (board.inputOnly && board.inputOnly.includes(c) && (s.dir !== 'in' || s.pullup)) { r.level = 'bad'; r.msg = ref(c) + ' can only be an input without a pull-up. Use ' + ref(plan) + '.'; return; }
      if (p.gpio == null) { r.level = 'bad'; r.msg = ref(c) + ' cannot be used for this. Use ' + ref(plan) + '.'; return; }
      if (s.k === 'pwm' && Array.isArray(board.pwm) && !board.pwm.includes(c)) { r.level = 'moved'; r.msg = 'Works, with software PWM (a servo may jitter a little). The code expects ' + ref(plan) + '.'; return; }
      if (s.k === 'w1' && board.family === 'pi') { r.level = 'moved'; r.msg = 'Works, if the 1-Wire setting names this pin. The code expects ' + ref(plan) + '.'; return; }
      r.level = 'moved'; r.msg = 'Works too. The code expects ' + ref(plan) + '.';
    });
    const worst = ['danger', 'bad', 'warn', 'todo', 'moved', 'ok'].find((l) => out.some((r) => r.level === l)) || 'ok';
    return { rows: out, worst, canFollow: out.some((r) => r.level === 'moved') && !out.some((r) => ['danger', 'bad'].includes(r.level)) };
  };

  // The "moved" wires, as overrides the pin planner can honour: { sigIndex: boardPinId }
  FM.followWiring = function (check) {
    const pins = {};
    check.rows.forEach((r) => { if (r.level === 'moved') pins[r.idx] = r.chosen; });
    return pins;
  };
})();
