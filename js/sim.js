/* Simulator: runs the block program in the browser with virtual parts, so you can
   try a project before buying anything. Sensors become sliders (or random / wave),
   outputs become a little virtual screen, LED, buzzer, speaker, servo and so on.
   It follows the same blocks as the generated code: Read -> Change -> Do. */
(function () {
  const esc = FM.esc;
  const RANGE = {
    co2: [400, 2500, 1], temperature: [-10, 45, 0.1], humidity: [0, 100, 1], pressure: [950, 1050, 0.1], eco2: [400, 2000, 1], tvoc: [0, 600, 1],
    air: [0, 100, 1], distance: [2, 400, 0.5], ax: [-20, 20, 0.01], ay: [-20, 20, 0.01], az: [-20, 20, 0.01], gx: [-250, 250, 0.1], gy: [-250, 250, 0.1], gz: [-250, 250, 0.1],
    lux: [0, 2000, 1], light: [0, 100, 1], moisture: [0, 100, 1], knob: [0, 100, 1], cpu_temp: [30, 85, 0.1], chip_temp: [15, 60, 0.1],
  };
  const START = { co2: 650, temperature: 22, humidity: 45, pressure: 1013, eco2: 600, tvoc: 40, air: 20, distance: 80, ax: 0, ay: 0, az: 9.8, gx: 0, gy: 0, gz: 0, lux: 300, light: 60, moisture: 55, knob: 50, cpu_temp: 48, chip_temp: 27, motion: 0, pressed: 0 };

  const sim = (FM.sim = { running: false, speed: 1, sound: true, sensors: {}, out: {}, log: [], rows: [], history: {}, last: {}, ticks: 0, t0: 0, timer: null, plot: FM.plotStore(), tg: [], mqtt: null });
  let el = null, ctx = null;

  sim.mount = (node, getCtx) => { el = node; ctx = getCtx; bind(); };

  function sensorKey(r) { return r.uid + '|' + r.k; }
  function sensor(r) {
    const key = sensorKey(r);
    if (!sim.sensors[key]) {
      const rg = RANGE[r.k] || [0, 100, 1];
      sim.sensors[key] = { mode: 'slider', value: START[r.k] != null ? START[r.k] : (rg[0] + rg[1]) / 2, min: rg[0], max: rg[1], step: rg[2] };
    }
    return sim.sensors[key];
  }

  // ---------- one tick of the program ----------
  function readValue(r, meta) {
    if (r.uid === 'sys' && r.k === 'uptime') return Math.round((Date.now() - sim.t0) / 1000 * sim.speed);
    if (r.uid === 'sys' && r.k === 'clock') { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
    const s = sensor(r);
    if (meta && meta.bool) {
      if (s.mode === 'random') s.value = Math.random() < 0.25 ? 1 : 0;
      if (s.mode === 'wave') s.value = Math.floor(sim.ticks / 4) % 2;
      return s.value ? 1 : 0;
    }
    if (s.mode === 'random') {
      const span = s.max - s.min;
      s.value = Math.min(s.max, Math.max(s.min, s.value + (Math.random() - 0.5) * span * 0.08));
    } else if (s.mode === 'wave') {
      const t = (Date.now() - sim.t0) / 1000 * sim.speed;
      s.value = s.min + (s.max - s.min) * (0.5 + 0.5 * Math.sin(t / 60 * 2 * Math.PI - Math.PI / 2));
    }
    return Math.round(s.value / s.step) * s.step;
  }

  function tick() {
    const { A, prog } = ctx();
    sim.ticks++;
    if (prog.mode === 'listen') return;
    const names = FM.programNames(A, prog);
    const bools = names.filter((n) => n.bool).map((n) => n.name);
    const raw = {};
    prog.reads.forEach((r) => { raw[r.name] = readValue(r, FM.valueMeta(A, r)); });
    const v = FM.applySteps(raw, prog.steps, sim.history);
    const alert = FM.checkLimit(v, prog.steps);
    sim.lastValues = v; sim.alert = alert;
    const now = Date.now();
    prog.actions.forEach((a) => {
      const inst = FM.actionTarget(A, a);
      const follows = a.act === 'onwhile' || a.act === 'colour' || a.act === 'angle' || a.act === 'follow' || a.act === 'number';
      if (!follows) {
        if (a.when === 'alert' && !alert) return;
        if (a.when === 'calm' && alert) return;
        if (a.every > 0) { if (sim.last[a.id] && (now - sim.last[a.id]) * sim.speed < a.every * 1000) return; sim.last[a.id] = now; }
      }
      const msg = FM.fillTemplate(a.msg || prog.message || FM.defaultMessage(A, prog), v, bools);
      const id = inst ? inst.uid : a.uid;
      const o = (sim.out[id] = sim.out[id] || {});
      const hasLimit = prog.steps.some((s) => s.t === 'limit');
      switch (a.act) {
        case 'print': addLog(msg); break;
        case 'plot': FM.plotPush(sim.plot, v); break;
        case 'mqtt': sim.mqtt = { topic: a.topic || 'friendly-microman/readings', payload: JSON.stringify(v), n: (sim.mqtt ? sim.mqtt.n : 0) + 1, at: now }; break;
        case 'telegram': sim.tg.push({ text: msg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }); sim.tg = sim.tg.slice(-4); addLog('\u2709 Telegram: ' + msg); break;
        case 'log': sim.rows.push([new Date().toLocaleTimeString()].concat(Object.values(v).map((x) => (typeof x === 'number' ? Math.round(x * 10) / 10 : x)))); sim.rows = sim.rows.slice(-6); sim.rowHead = ['time'].concat(Object.keys(v)); break;
        case 'show': o.text = msg; break;
        case 'say': o.text = msg; o.at = now; speak(msg); addLog('\u{1F50A} ' + msg); break;
        case 'beep': o.at = now; beep(a.n || 3); break;
        case 'blink': o.blinkAt = now; o.n = a.n || 3; break;
        case 'onwhile': o.on = alert; break;
        case 'angle': o.angle = hasLimit ? (alert ? +a.angle || 0 : +a.angle2 || 0) : +a.angle || 0; break;
        case 'follow': { const x = v[a.key]; if (typeof x === 'number') o.angle = Math.max(0, Math.min(180, (x - (+a.min || 0)) / (((+a.max || 100) - (+a.min || 0)) || 1) * 180)); break; }
        case 'colour': o.colour = alert ? a.colour : (hasLimit ? a.colour2 || '#000000' : a.colour); break;
        case 'number': o.number = typeof v[a.key] === 'number' ? Math.round(v[a.key]) : null; break;
        case 'turn': o.turned = (o.turned || 0) + (+a.steps || 512); break;
        case 'photo': o.at = now; o.count = (o.count || 0) + 1; addLog('\u{1F4F7} photo_' + o.count + '.jpg saved'); break;
        default: break;
      }
    });
    paintOutputs();
  }

  function addLog(line) { sim.log.push(line); sim.log = sim.log.slice(-80); }

  // Listen mode: type a command, the rules decide.
  function command(text) {
    const { A, prog } = ctx();
    const L = prog.listen;
    addLog('You: ' + text);
    const t = text.toLowerCase();
    const rule = L.rules.find((r) => String(r.say || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).some((w) => t.includes(w)));
    let reply = 'Sorry, I do not know that command';
    if (rule) {
      if (rule.do === 'time') { const d = new Date(); reply = 'It is ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
      else if (rule.do === 'text') reply = rule.text || 'Hello!';
      else if (rule.do === 'stop') { reply = 'Goodbye'; }
      else if (rule.do === 'reading') { const r = { uid: rule.uid, k: rule.k }; reply = FM.fillTemplate(rule.text || '{value}', { value: readValue(r, FM.valueMeta(A, r)) }, []); }
      else if (rule.do === 'on' || rule.do === 'off') { const o = (sim.out[rule.uid] = sim.out[rule.uid] || {}); o.on = rule.do === 'on'; const i = A.byUid[rule.uid]; reply = (i ? i.short : 'Part') + ' ' + rule.do; }
      else if (rule.do === 'photo') { const o = (sim.out[rule.uid] = sim.out[rule.uid] || {}); o.at = Date.now(); o.count = (o.count || 0) + 1; reply = 'Photo taken'; }
    }
    L.replies.forEach((r) => {
      if (r === 'print') return;
      const i = A.byUid[r];
      if (!i) return;
      const o = (sim.out[r] = sim.out[r] || {});
      o.text = reply; o.at = Date.now();
      if (i.def.audio) speak(reply);
    });
    addLog((ctx().board.family === 'pi' ? 'Pi: ' : 'Board: ') + reply);
    paintOutputs();
  }

  // ---------- sound ----------
  let audio = null;
  function beep(n) {
    if (!sim.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      for (let k = 0; k < n; k++) {
        const o = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = 2300; o.type = 'square'; g.gain.value = 0.04;
        o.connect(g); g.connect(audio.destination);
        const t = audio.currentTime + k * 0.2;
        o.start(t); o.stop(t + 0.1);
      }
    } catch (e) { /* no audio here */ }
  }
  function speak(text) {
    if (!sim.sound || !('speechSynthesis' in window)) return;
    try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } catch (e) { /* no speech here */ }
  }

  // ---------- run control ----------
  sim.start = function () {
    sim.running = true; sim.t0 = Date.now(); sim.ticks = 0; sim.history = {}; sim.last = {}; sim.plot = FM.plotStore(); sim.tg = []; sim.mqtt = null;
    schedule(); tick(); sim.render();
  };
  sim.reset = function () { sim.running = false; clearTimeout(sim.timer); sim.out = {}; sim.log = []; sim.rows = []; sim.sensors = {}; sim.lastValues = null; sim.touched = false; sim.plot = FM.plotStore(); sim.tg = []; sim.mqtt = null; };
  sim.stop = function () { sim.running = false; clearTimeout(sim.timer); sim.render(); };
  function schedule() {
    clearTimeout(sim.timer);
    if (!sim.running) return;
    const { prog } = ctx();
    const ms = Math.max(250, (prog.interval || 5) * 1000 / sim.speed);
    sim.timer = setTimeout(() => { if (!sim.running) return; try { tick(); } catch (e) { addLog('[simulator] ' + e.message); } schedule(); }, ms);
  }

  // ---------- drawing ----------
  sim.render = function () {
    if (!el) return;
    const { A, prog, board } = ctx();
    const listen = prog.mode === 'listen';
    let h = '<div class="panel-head"><h2 id="simTitle">Try it without hardware</h2><p>Every part works here as a virtual part, so you can test a project before you buy anything. Move the sliders and watch the outputs.</p></div>';
    h += '<div class="simbar">' + (listen ? '' : sim.running ? '<button type="button" class="btn" data-sim="stop">■ Stop</button>' : '<button type="button" class="btn primary" data-sim="start">▶ Run the program</button>') +
      (listen ? '' : '<label class="small muted">Speed <select data-simspeed="1">' + [1, 5, 20].map((x) => '<option value="' + x + '"' + (sim.speed === x ? ' selected' : '') + '>' + x + '×</option>').join('') + '</select></label>') +
      '<label class="small muted"><input type="checkbox" data-simsound="1"' + (sim.sound ? ' checked' : '') + '> Sound</label>' +
      (sim.running && !listen ? '<span class="small muted">reading every ' + (prog.interval || 5) + ' s' + (sim.speed > 1 ? ' (shown ' + sim.speed + '× faster)' : '') + '</span>' : '') + '</div>';
    h += '<div class="simgrid"><div><div class="section-title read">Virtual sensors</div>';
    if (listen) h += '<div class="vcard"><b>Type a command</b><div class="sendline"><input type="text" id="simCmd" placeholder="e.g. what time is it" aria-label="Command"><button type="button" class="btn" data-simsend="1">Say it</button></div><p class="small muted" style="margin:6px 0 0">' + (prog.listen.via === 'voice' ? 'On the real Pi you speak this into the microphone.' : 'On the real board you type this in the terminal.') + '</p></div>';
    const seen = {};
    const sources = listen ? prog.listen.rules.filter((r) => r.do === 'reading' && r.uid).map((r) => ({ uid: r.uid, k: r.k })) : prog.reads;
    sources.forEach((r) => {
      const key = sensorKey(r);
      if (seen[key]) return; seen[key] = 1;
      const m = FM.valueMeta(A, r);
      const inst = r.uid === 'sys' ? null : A.byUid[r.uid];
      const label = (inst ? inst.short : board.short) + ' · ' + (m ? m.l : r.k);
      if (r.k === 'uptime' || r.k === 'clock') { h += '<div class="vcard"><b>' + esc(label) + '</b><p class="small muted" style="margin:4px 0 0">Comes from the clock.</p></div>'; return; }
      const s = sensor(r);
      h += '<div class="vcard"><div class="vhead"><b>' + esc(label) + '</b>' + '<select data-simmode="' + esc(key) + '" aria-label="How the value changes">' + [['slider', 'I set it'], ['random', 'drifts'], ['wave', 'up and down']].map(([k, l]) => '<option value="' + k + '"' + (s.mode === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>';
      if (m && m.bool) h += '<label class="line"><input type="checkbox" data-simbool="' + esc(key) + '"' + (s.value ? ' checked' : '') + '> ' + (r.k === 'motion' ? 'someone moves' : 'pressed') + '</label>';
      else h += '<div class="vslider"><input type="range" min="' + s.min + '" max="' + s.max + '" step="' + s.step + '" value="' + s.value + '" data-simval="' + esc(key) + '" aria-label="' + esc(label) + '"><output data-simout="' + esc(key) + '">' + fmtNum(s.value, s.step) + ' ' + esc(m ? m.u : '') + '</output></div>';
      h += '</div>';
    });
    if (!prog.reads.length && !listen) h += '<div class="empty">Add something to Read in the program, and its virtual sensor appears here.</div>';
    h += '</div><div><div class="section-title do">Virtual outputs</div><div id="simOut"></div></div></div>';
    el.innerHTML = h;
    paintOutputs();
  };

  const fmtNum = (x, step) => (step < 1 ? (+x).toFixed(step < 0.1 ? 2 : 1) : Math.round(x));

  function paintOutputs() {
    const box = el && el.querySelector('#simOut');
    if (!box) return;
    const { A, prog, board } = ctx();
    const listen = prog.mode === 'listen';
    const targets = [];
    const add = (uid) => { if (uid && !targets.includes(uid)) targets.push(uid); };
    if (listen) { prog.listen.replies.forEach((r) => r !== 'print' && add(r)); prog.listen.rules.forEach((r) => ['on', 'off', 'photo'].includes(r.do) && add(r.uid)); }
    else prog.actions.forEach((a) => { if (a.uid !== 'print' && a.uid !== 'log') add(a.uid); });
    let h = '';
    targets.forEach((uid) => {
      const i = A.byUid[uid];
      if (!i) return;
      const o = sim.out[uid] || {};
      h += '<div class="vcard"><b>' + esc(i.label) + '</b>' + drawOutput(i, o) + '</div>';
    });
    if (!listen && sim.lastValues && prog.steps.some((s) => s.t === 'limit')) h = '<div class="vcard"><b>Check</b> <span class="tag" style="background:' + (sim.alert ? 'var(--bad-bg)' : 'var(--sunk)') + '">' + (sim.alert ? 'true' : 'false') + '</span></div>' + h;
    const has = (uid) => !listen && prog.actions.some((a) => a.uid === uid);
    if (has('plot')) {
      const units = {};
      FM.programNames(A, prog).forEach((n) => { units[n.name] = n.unit || ''; });
      h += '<div class="vcard"><b>Live graph</b>' + (FM.chart(sim.plot, units) || '<p class="small muted" style="margin:0">' + (sim.running ? 'Waiting for the first reading…' : 'Run the program to draw the values.') + '</p>') + '</div>';
    }
    if (has('telegram')) h += '<div class="vcard"><b>Telegram (a pretend phone)</b><div class="v-phone">' + (sim.tg.length ? sim.tg.map((m) => '<div class="v-bubble">' + esc(m.text) + '<small>' + esc(m.time) + '</small></div>').join('') : '<p class="small muted" style="margin:0">Messages from your bot appear here.</p>') + '</div></div>';
    if (has('mqtt')) h += '<div class="vcard"><b>MQTT</b>' + (sim.mqtt ? '<div class="small"><span class="mono">' + esc(sim.mqtt.topic) + '</span> · sent ' + sim.mqtt.n + '×</div><div class="monitor sim-term" style="height:auto">' + esc(sim.mqtt.payload) + '</div>' : '<p class="small muted" style="margin:0">Nothing sent yet.</p>') + '</div>';
    h += '<div class="vcard"><b>' + (board.family === 'pi' ? 'Terminal' : 'Serial monitor') + '</b><div class="monitor sim-term" id="simLog">' + esc(sim.log.join('\n') || (sim.running || listen ? '' : 'Press "Run the program" to start.')) + '</div></div>';
    if (sim.rows.length) h += '<div class="vcard"><b>readings.csv</b><div style="overflow-x:auto"><table class="csv"><tr>' + sim.rowHead.map((x) => '<th>' + esc(x) + '</th>').join('') + '</tr>' + sim.rows.map((r) => '<tr>' + r.map((x) => '<td>' + esc(x) + '</td>').join('') + '</tr>').join('') + '</table></div></div>';
    box.innerHTML = h;
    const log = box.querySelector('#simLog');
    if (log) log.scrollTop = log.scrollHeight;
  }

  function drawOutput(i, o) {
    const id = i.def.id;
    const fresh = (t, ms) => t && Date.now() - t < (ms || 1200);
    if (id === 'oled') return '<div class="v-oled">' + esc(wrap(o.text || '', 21).slice(0, 6).join('\n')) + '</div>';
    if (id === 'lcd1602') { const t = (o.text || '').slice(0, 32); return '<div class="v-lcd">' + esc(t.slice(0, 16).padEnd(16, ' ')) + '\n' + esc(t.slice(16, 32).padEnd(16, ' ')) + '</div>'; }
    if (id === 'tm1637') return '<div class="v-digits">' + esc(o.number == null ? '----' : String(o.number).slice(-4).padStart(4, ' ')) + '</div>';
    if (id === 'led') { const on = o.on || (o.blinkAt && Date.now() - o.blinkAt < (o.n || 3) * 400); return '<div class="v-led' + (on ? ' on' : '') + '" style="--c:#ff3b30"></div><span class="small muted">' + (on ? 'on' : 'off') + '</span>'; }
    if (id === 'relay') return '<div class="v-relay' + (o.on ? ' on' : '') + '">' + (o.on ? 'ON · click!' : 'OFF') + '</div>';
    if (id === 'buzzer') return '<div class="v-buzz' + (fresh(o.at, 900) ? ' on' : '') + '">\u{1F50A} ' + (fresh(o.at, 900) ? 'beep beep' : 'quiet') + '</div>';
    if (i.def.audio) return '<div class="v-speech' + (fresh(o.at, 6000) ? ' on' : '') + '">' + esc(o.text || 'Nothing said yet.') + '</div>';
    if (id === 'servo') { const a = o.angle == null ? 90 : o.angle; const rad = (180 - a) * Math.PI / 180; return '<svg viewBox="0 0 120 70" class="v-servo"><path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="var(--line)" stroke-width="6"/><line x1="60" y1="62" x2="' + (60 + 46 * Math.cos(rad)).toFixed(1) + '" y2="' + (62 - 46 * Math.sin(rad)).toFixed(1) + '" stroke="var(--do)" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="62" r="6" fill="var(--ink)"/><text x="60" y="40" text-anchor="middle" font-size="12" fill="var(--muted)">' + Math.round(a) + '°</text></svg>'; }
    if (id === 'rgbled') return '<div class="v-led on" style="--c:' + esc(o.colour || '#000') + '"></div>';
    if (id === 'ws2812') return '<div class="v-strip">' + Array.from({ length: 8 }, () => '<i style="background:' + esc(o.colour || '#222') + '"></i>').join('') + '</div>';
    if (id === 'stepper') return '<div class="small">Turned ' + (o.turned || 0) + ' steps (' + ((o.turned || 0) / 4096 * 360).toFixed(0) + '°)</div>';
    if (id === 'camera') return '<div class="v-cam' + (fresh(o.at, 500) ? ' on' : '') + '">' + (o.count ? o.count + ' photo' + (o.count > 1 ? 's' : '') + ' taken' : 'ready') + '</div>';
    return '<p class="small muted">No virtual view for this part yet.</p>';
  }
  function wrap(text, width) {
    const out = []; let line = '';
    String(text).split(/\s+/).forEach((w) => { if (line && (line + ' ' + w).length > width) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); });
    if (line) out.push(line);
    return out;
  }

  // ---------- events ----------
  function bind() {
    el.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.sim === 'start') sim.start();
      if (t.dataset.sim === 'stop') sim.stop();
      if (t.dataset.simsend) send();
    });
    el.addEventListener('keydown', (e) => { if (e.target.id === 'simCmd' && e.key === 'Enter') { e.preventDefault(); send(); } });
    el.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.simval) {
        const s = sim.sensors[t.dataset.simval];
        s.value = +t.value; s.mode = 'slider'; sim.touched = true;
        const out = el.querySelector('[data-simout="' + CSS.escape(t.dataset.simval) + '"]');
        if (out) out.textContent = fmtNum(s.value, s.step) + out.textContent.replace(/^[-\d.]+/, '');
        const sel = el.querySelector('[data-simmode="' + CSS.escape(t.dataset.simval) + '"]');
        if (sel) sel.value = 'slider';
      }
    });
    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.simmode) { sim.sensors[t.dataset.simmode].mode = t.value; sim.touched = true; }
      if (t.dataset.simbool) { sim.touched = true; sim.sensors[t.dataset.simbool].value = t.checked ? 1 : 0; sim.sensors[t.dataset.simbool].mode = 'slider'; if (sim.running) tick(); }
      if (t.dataset.simspeed) { sim.speed = +t.value; schedule(); }
      if (t.dataset.simsound) { sim.sound = t.checked; if (!sim.sound && 'speechSynthesis' in window) speechSynthesis.cancel(); }
    });
    // keep the slider positions moving while "drifts" or "up and down" is on
    setInterval(() => {
      if (!sim.running || !el) return;
      Object.entries(sim.sensors).forEach(([key, s]) => {
        if (s.mode === 'slider') return;
        const r = el.querySelector('[data-simval="' + CSS.escape(key) + '"]');
        if (r) { r.value = s.value; const out = el.querySelector('[data-simout="' + CSS.escape(key) + '"]'); if (out) out.textContent = fmtNum(s.value, s.step) + out.textContent.replace(/^[-\d.]+/, ''); }
        const b = el.querySelector('[data-simbool="' + CSS.escape(key) + '"]');
        if (b) b.checked = !!s.value;
      });
      paintOutputs();
    }, 500);
  }
  function send() {
    const input = el.querySelector('#simCmd');
    if (!input || !input.value.trim()) return;
    command(input.value.trim());
    input.value = '';
    input.focus();
  }
})();
