/* Pin planner: given a board profile and the parts you picked, choose pins that
   do not clash, share buses where possible (one I2C bus for many sensors),
   pick the closest power and ground pins, and explain every choice. */
(function () {
  const COLORS = {
    v5: ['#d7263d', 'red'], v3: ['#f18f01', 'orange'], gnd: ['#1b1b1b', 'black'],
    sda: ['#2e86de', 'blue'], scl: ['#f4d03f', 'yellow'],
  };
  const CYCLE = [['#27ae60', 'green'], ['#ecf0f1', 'white'], ['#8e44ad', 'purple'], ['#95a5a6', 'grey'], ['#8d5524', 'brown'], ['#16a5b8', 'cyan']];
  const POWER_TYPES = ['v3', 'v5', 'vin', 'gnd', 'sys'];

  FM.allocate = function (board, build) {
    const res = {
      board, inst: [], use: {}, warn: [], tips: [], cmds: [], cfg: [], rails: { v3: 0, v5: 0 }, byUid: {},
      busUsed: {}, ports: { usb: [], hdmi: [], jack: [], csi: [] },
    };
    const addCmd = (c) => { if (c && !res.cmds.includes(c)) res.cmds.push(c); };
    const addCfg = (c) => { if (c && !res.cfg.includes(c)) res.cfg.push(c); };

    // ---- positions, for "closest pin" decisions ----
    const pos = {};
    const L = board.layout;
    L.left.forEach((id, i) => { if (id) pos[id] = { side: 0, row: i }; });
    L.right.forEach((id, i) => { if (id) pos[id] = { side: 1, row: i }; });
    const sideCost = L.kind === 'paired' ? 0.5 : 4;
    const dist = (a, b) => { const A = pos[a], B = pos[b]; if (!A || !B) return 0; return Math.abs(A.row - B.row) + (A.side === B.side ? 0 : sideCost); };

    // ---- instances ----
    const counts = {}, totals = {};
    build.forEach((b) => { if (FM.parts[b.id]) totals[b.id] = (totals[b.id] || 0) + 1; });
    build.forEach((b) => {
      const def = FM.parts[b.id];
      if (!def) return;
      counts[b.id] = (counts[b.id] || 0) + 1;
      res.inst.push({ uid: b.uid, def, n: counts[b.id], total: totals[b.id] });
    });

    // Analog parts: use the board's own analog pins, or add an ADS1115 for boards without them (Pi).
    const analog = res.inst.filter((i) => i.def.sig.some((s) => s.k === 'adc'));
    const needExternalAdc = board.adc.length === 0 && analog.length > 0;
    if (needExternalAdc) {
      const manual = res.inst.filter((i) => i.def.id === 'ads1115').length;
      const need = Math.min(4, Math.ceil(analog.length / 4)) - manual;
      for (let a = 0; a < need; a++) {
        res.inst.push({ uid: 'auto-adc-' + a, def: FM.parts.ads1115, auto: true, n: manual + a + 1, total: manual + need });
      }
    }

    res.inst.forEach((i) => {
      i.label = i.def.name + (i.total > 1 ? ' #' + i.n : '');
      i.short = i.def.name.split(' (')[0].split(' ').slice(0, 2).join(' ') + (i.total > 1 ? ' #' + i.n : '');
      i.var = (i.def.v || i.def.id) + (i.n > 1 ? '_' + i.n : '');
      i.pins = {}; i.wires = []; i.notes = []; i.color = null;
      i.supported = i.def.families.includes(board.family);
      res.byUid[i.uid] = i;
      if (!i.supported) res.warn.push(i.label + ' does not work with ' + board.short + '. ' + (i.def.families.length === 1 && i.def.families[0] === 'pi' ? 'It needs a Raspberry Pi.' : ''));
    });
    const live = res.inst.filter((i) => i.supported && !i.def.port);

    const isFree = (id) => !(res.use[id] && res.use[id].length);
    const pinOk = (id, sig) => {
      const p = board.pins[id];
      if (!p || p.gpio == null || POWER_TYPES.includes(p.type) || board.avoid[id]) return false;
      if (board.inputOnly && board.inputOnly.includes(id) && (sig.dir !== 'in' || sig.pullup)) return false;
      return true;
    };
    const claim = (inst, idx, id) => {
      (res.use[id] = res.use[id] || []).push({ uid: inst.uid, label: inst.short, devPin: inst.def.sig[idx].p });
      inst.pins[idx] = id;
      // On the Uno the SDA/SCL header pins are the same wires as A4/A5.
      const al = board.bus.i2c && board.bus.i2c.alias;
      if (al) {
        if (id === board.bus.i2c.sda) (res.use[al.sda] = res.use[al.sda] || []).push({ uid: inst.uid, label: inst.short, devPin: 'same as ' + board.pins[id].label, mirror: true });
        if (id === board.bus.i2c.scl) (res.use[al.scl] = res.use[al.scl] || []).push({ uid: inst.uid, label: inst.short, devPin: 'same as ' + board.pins[id].label, mirror: true });
      }
    };
    const fromPool = (sig, prefer) => {
      const list = (prefer || []).concat(board.gpioPool);
      return list.find((id) => isFree(id) && pinOk(id, sig));
    };
    const each = (kind, fn) => live.forEach((inst) => inst.def.sig.forEach((s, idx) => { if (s.k === kind) fn(inst, s, idx); }));

    // ---- 1. I2C: one shared bus ----
    const addrs = {};
    live.filter((i) => i.def.sig.some((s) => s.k === 'sda')).forEach((inst) => {
      const b = board.bus.i2c;
      inst.def.sig.forEach((s, idx) => { if (s.k === 'sda') claim(inst, idx, b.sda); if (s.k === 'scl') claim(inst, idx, b.scl); });
      res.busUsed.i2c = true;
      // pick a free address; use the part's alternate address if the default is taken
      const options = [inst.def.addr].concat(inst.def.alts || []);
      let a = options.find((x) => !addrs[x]);
      if (a == null) { a = inst.def.addr; res.warn.push(inst.label + ' has the same I2C address (' + FM.hex(a) + ') as ' + addrs[a] + '. Two of these cannot share one bus.'); }
      else if (a !== inst.def.addr) res.tips.push(inst.label + ' moved to I2C address ' + FM.hex(a) + ' so it does not clash with ' + addrs[inst.def.addr] + '. ' + (inst.def.id === 'bme280' ? 'Connect its SDO pin to 3V3.' : inst.def.id === 'ads1115' ? 'Connect its ADDR pin to ' + ['GND', 'VDD', 'SDA', 'SCL'][options.indexOf(a)] + '.' : 'Set the address jumper on the board.'));
      addrs[a] = addrs[a] || inst.label;
      inst.addr = a;
    });
    if (res.busUsed.i2c && board.family === 'pi') addCmd(board.bus.i2c.how);
    if (live.some((i) => i.def.id === 'scd30') && board.family === 'pi') addCfg('dtparam=i2c_arm_baudrate=50000');

    // ---- 2. SPI: shared data lines, one chip-select each ----
    let csIdx = 0;
    live.filter((i) => i.def.sig.some((s) => s.k === 'mosi')).forEach((inst) => {
      const b = board.bus.spi;
      inst.def.sig.forEach((s, idx) => {
        if (s.k === 'mosi') claim(inst, idx, b.mosi);
        if (s.k === 'miso') claim(inst, idx, b.miso);
        if (s.k === 'sck') claim(inst, idx, b.sck);
        if (s.k === 'cs') {
          const fixed = b.cs[csIdx++];
          const id = fixed && isFree(fixed) ? fixed : fromPool(s);
          if (id) { claim(inst, idx, id); if (!fixed) inst.notes.push('Uses a normal pin as chip select.'); }
        }
      });
      res.busUsed.spi = true;
    });
    if (res.busUsed.spi && board.family === 'pi') addCmd(board.bus.spi.how);

    // ---- 3. UART: one part per serial port ----
    const uarts = (board.bus.uart || []).slice();
    if (board.uartExtra) uarts.push(Object.assign({ extra: true }, board.uartExtra));
    live.filter((i) => i.def.sig.some((s) => s.k === 'tx')).forEach((inst) => {
      const u = uarts.shift();
      if (!u) { res.warn.push('No serial port left for ' + inst.label + '. Use a USB-to-serial adapter instead.'); return; }
      inst.uart = u;
      inst.def.sig.forEach((s, idx) => {
        if (u.soft) {
          if (s.k === 'tx' || s.k === 'rx') { const id = fromPool(s); if (id) claim(inst, idx, id); }
        } else {
          if (s.k === 'tx') claim(inst, idx, u.rx); // part TX -> board RX
          if (s.k === 'rx') claim(inst, idx, u.tx);
        }
      });
      if (u.note) inst.notes.push(u.note);
      if (board.family === 'pi') {
        if (u.extra) { addCfg(u.overlay); inst.notes.push('Uses the second serial port on GPIO4/GPIO5 because the main one is taken.'); }
        else (u.how || []).forEach(addCmd);
      }
    });

    // ---- 4. I2S audio (Pi): fixed pins ----
    let i2sTaken = false;
    live.filter((i) => i.def.sig.some((s) => s.k === 'i2s_bclk')).forEach((inst) => {
      const b = board.bus.i2s;
      if (!b || b.flexible) { res.warn.push(inst.label + ' needs I2S audio pins, which this board profile does not offer yet.'); return; }
      if (i2sTaken) { res.warn.push('Only one I2S amp can be used at a time.'); return; }
      i2sTaken = true;
      inst.def.sig.forEach((s, idx) => {
        if (s.k === 'i2s_bclk') claim(inst, idx, b.bclk);
        if (s.k === 'i2s_ws') claim(inst, idx, b.ws);
        if (s.k === 'i2s_din') claim(inst, idx, b.dout);
      });
      addCfg('dtoverlay=max98357a');
    });

    // ---- 5. Addressable LEDs ----
    each('ws', (inst, s, idx) => {
      const pref = Array.isArray(board.bus.ws) ? board.bus.ws.filter((id) => isFree(id) && !(id === '19' && res.busUsed.spi)) : [];
      const id = pref[0] || fromPool(s);
      if (id) claim(inst, idx, id);
      if (board.family === 'pi' && id !== '12') res.warn.push('LED strips on a Pi work best on GPIO18 (pin 12), which is already taken.');
    });

    // ---- 6. 1-Wire: all probes share one pin ----
    let w1Pin = null;
    each('w1', (inst, s, idx) => {
      if (!w1Pin) {
        const b = board.bus.w1 || {};
        w1Pin = b.pin && isFree(b.pin) ? b.pin : fromPool(s);
        if (board.family === 'pi' && w1Pin) {
          const g = board.pins[w1Pin].gpio;
          addCfg(g === 4 ? 'dtoverlay=w1-gpio' : 'dtoverlay=w1-gpio,gpiopin=' + g);
          if (g !== 4) res.tips.push('1-Wire moved from GPIO4 to GPIO' + g + ' because GPIO4 is busy.');
        }
      }
      if (w1Pin) claim(inst, idx, w1Pin);
    });

    // ---- 7. PWM ----
    each('pwm', (inst, s, idx) => {
      let id;
      if (board.pwm === 'all') id = fromPool(s);
      else id = board.pwm.find((p) => isFree(p) && pinOk(p, s)) || fromPool(s);
      if (!id) return;
      claim(inst, idx, id);
      if (board.pwm !== 'all' && !board.pwm.includes(id)) inst.notes.push(board.pins[id].label + ' has no hardware PWM, so the code uses software PWM (may jitter a little).');
    });

    // ---- 8. Analog ----
    const adcInsts = res.inst.filter((i) => i.def.id === 'ads1115' && i.supported);
    let adcSlot = 0;
    each('adc', (inst, s, idx) => {
      if (board.adc.length) {
        const slot = board.adc.find((a) => isFree(a.pin));
        if (!slot) { res.warn.push('No analog input left for ' + inst.label + '. ' + board.short + ' has ' + board.adc.length + '.'); return; }
        claim(inst, idx, slot.pin);
        inst.adcCh = slot.ch; inst.adcPin = slot.pin;
      } else {
        const adc = adcInsts[Math.floor(adcSlot / 4)];
        if (!adc) { res.warn.push('Too many analog parts: at most 16 with four ADS1115 boards.'); return; }
        inst.adc = { uid: adc.uid, ch: adcSlot % 4, label: adc.short };
        inst.wires.push({ idx, devPin: s.p, to: adc.short + ' · A' + (adcSlot % 4), color: CYCLE[adcSlot % CYCLE.length] });
        adcSlot++;
      }
    });

    // ---- 9. Plain GPIO (and anything left) ----
    each('gpio', (inst, s, idx) => {
      const id = fromPool(s);
      if (!id) { res.warn.push('Out of free pins for ' + inst.label + '. Remove a part or use a pin expander (MCP23017).'); return; }
      claim(inst, idx, id);
    });

    // ---- 10. Power and ground: closest pin, spread the load ----
    const powerUse = {};
    live.forEach((inst) => {
      const sigPins = Object.values(inst.pins);
      if (!sigPins.length && inst.adc) { const a = res.byUid[inst.adc.uid]; sigPins.push(...Object.values(a.pins)); }
      inst.def.sig.forEach((s, idx) => {
        let rail = s.k;
        if (rail === 'vcc') rail = board.logic === 5 ? 'v5' : 'v3';
        if (!['v3', 'v5', 'gnd'].includes(rail)) return;
        const cands = board.power[rail] || [];
        if (!cands.length) { res.warn.push(board.short + ' has no ' + rail + ' pin for ' + inst.label + '.'); return; }
        let best = null, bestScore = 1e9;
        cands.forEach((c) => {
          const d = sigPins.length ? sigPins.reduce((sum, p) => sum + dist(c, p), 0) / sigPins.length : 0;
          const score = d + (powerUse[c] || 0) * 1.5;
          if (score < bestScore) { bestScore = score; best = c; }
        });
        powerUse[best] = (powerUse[best] || 0) + 1;
        claim(inst, idx, best);
        if (rail !== 'gnd') res.rails[rail] += inst.def.ma || 0;
      });
    });
    Object.entries(powerUse).forEach(([id, n]) => {
      if (n > 2) res.tips.push(FM.pinRef(board, id) + ' feeds ' + n + ' wires. Run one wire to the breadboard rail and connect the parts there.');
    });

    // ---- 11. Logic levels and power budget ----
    live.forEach((inst) => {
      inst.def.sig.forEach((s) => {
        if (s.out5v && board.logic < 5 && s.k !== 'adc') inst.notes.push('⚠ ' + s.p + ' sends 5 V. Use a voltage divider before the ' + board.short + ' pin.');
        if (s.out5v && board.logic < 5 && s.k === 'adc' && board.adc.length) inst.notes.push('⚠ ' + s.p + ' can reach 5 V. Use a voltage divider (10 kΩ + 20 kΩ) before the analog pin.');
      });
      if (inst.def.only33 && board.logic === 5) res.warn.push(inst.label + ' is 3.3 V only. Use a level shifter on its signal wires with a 5 V board.');
      if (inst.def.power === 'v5' && board.family !== 'pi' && board.family !== 'arduino') inst.notes.push('Gets 5 V from ' + FM.pinRef(board, board.power.v5[0]) + ', which only works while the board is powered by USB.');
    });
    const v3limit = { pi: 500, pico: 300, esp32: 400, esp8266: 300, arduino: 50 }[board.family];
    if (res.rails.v3 > v3limit) res.warn.push('The 3.3 V parts draw about ' + res.rails.v3 + ' mA, more than ' + board.short + ' can give (about ' + v3limit + ' mA).');
    const hungry = live.filter((i) => ['servo', 'ws2812', 'stepper'].includes(i.def.id));
    if (hungry.length > 1 || res.rails.v5 > 600) res.tips.push('Motors and LED strips draw a lot. Power them from a separate 5 V supply and connect its GND to the board GND.');

    // ---- 12. Sockets (USB, HDMI, audio jack, camera) ----
    res.inst.filter((i) => i.supported && i.def.port).forEach((inst) => {
      res.ports[inst.def.port].push(inst);
      if (inst.def.port === 'jack' && !board.jack) res.warn.push(board.short + ' has no headphone jack. Use a USB speaker, HDMI audio or an I2S amp instead.');
    });
    const usbMax = board.usbCount || 4;
    if (res.ports.usb.length > usbMax) res.tips.push('You have ' + res.ports.usb.length + ' USB parts but only ' + usbMax + ' USB port' + (usbMax > 1 ? 's' : '') + '. Use a USB hub.');
    if (board.id === 'zero' && res.ports.usb.length) res.tips.push('The Zero needs a micro-USB OTG adapter for USB parts.');

    // ---- 13. Build the wire lists ----
    live.forEach((inst, k) => {
      let c = 0;
      inst.def.sig.forEach((s, idx) => {
        const id = inst.pins[idx];
        if (s.k === 'none') { inst.wires.push({ idx, devPin: s.p, to: 'Leave unconnected', color: null }); return; }
        if (id == null) return;
        let rail = s.k === 'vcc' ? (board.logic === 5 ? 'v5' : 'v3') : s.k;
        const col = COLORS[rail] || CYCLE[(c++ + k) % CYCLE.length];
        const shared = (res.use[id] || []).filter((u) => !u.mirror).length > 1;
        inst.wires.push({ idx, devPin: s.p, pin: id, to: FM.pinRef(board, id), color: col, shared, rail });
      });
      // ground first, then power, then signals: the safe order to plug things in
      const order = (w) => (w.rail === 'gnd' ? 0 : w.rail === 'v3' || w.rail === 'v5' ? 1 : 2);
      inst.wires.sort((a, b) => order(a) - order(b));
    });
    res.free = Object.keys(board.pins).filter((id) => pinOk(id, {}) && isFree(id));
    return res;
  };
})();
