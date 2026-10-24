/* friendly-microman UI. One state object, re-rendered on every change.
   Text inputs update the code live without re-rendering, so typing never loses focus. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = FM.esc;
  const STORE = 'fm-state-v1';
  // Embedded previews cannot save files, so the Download button only shows on a normal page.
  let inFrame = true;
  try { inFrame = window.self !== window.top; } catch (e) { /* cross-origin parent */ }

  // ---------------- state ----------------
  let S = null;
  let A = null; // pin plan for the current build
  let G = null; // generated code
  const ui = { picker: null, pin: null, libQuery: '', monitor: '', toastTimer: null, undo: null, busy: '' };

  function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* storage blocked */ } }
  function load() { try { return JSON.parse(localStorage.getItem(STORE)); } catch (e) { return null; } }

  function fresh() {
    const board = FM.boards.pi5;
    const t = FM.loadTemplate(FM.templates[0], board);
    return { board: 'pi5', lang: null, build: t.build, program: t.program, title: t.title, starter: FM.templates[0].id, sel: t.build[0].uid, cat: 'all', q: '', tab: 'code', codeEdited: false, code: '' };
  }

  const board = () => FM.boards[S.board];
  const lang = () => { const l = FM.langsFor(board()); return l.includes(S.lang) ? S.lang : l[0]; };
  const P = () => S.program;

  // ---------------- helpers ----------------
  function toast(msg, undo) {
    const el = $('#toast');
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button type="button" id="undoBtn">Undo</button>' : '');
    el.hidden = false;
    ui.undo = undo || null;
    if (undo) $('#undoBtn').onclick = () => { const u = ui.undo; ui.undo = null; el.hidden = true; u(); };
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(() => { el.hidden = true; ui.undo = null; }, undo ? 7000 : 3200);
  }
  const snapshot = () => JSON.stringify(S);
  const restore = (snap) => { S = JSON.parse(snap); render(); };

  function setPath(obj, path, value) {
    const keys = path.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) o = o[/^\d+$/.test(keys[i]) ? +keys[i] : keys[i]];
    o[keys[keys.length - 1]] = value;
  }
  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[/^\d+$/.test(k) ? +k : k]), obj); }

  const instsOf = (id) => A.inst.filter((i) => i.def.id === id && !i.auto);
  const hasAudio = () => A.inst.some((i) => i.supported && i.def.audio);
  const hasScreen = () => A.inst.some((i) => i.supported && ['oled', 'lcd1602'].includes(i.def.id));

  function addPart(id, opts) {
    const uid = FM.uid();
    S.build.push({ uid, id });
    if (!opts || opts.select !== false) S.sel = uid;
    S.starter = null;
    return uid;
  }

  function removeInst(uid) {
    const snap = snapshot();
    const i = A.byUid[uid];
    S.build = S.build.filter((b) => b.uid !== uid);
    if (S.sel === uid) S.sel = null;
    render();
    toast('Removed ' + (i ? i.label : 'part') + '.', () => restore(snap));
  }

  // Sample values for the live message preview.
  const SAMPLE = { co2: 812, temperature: 22.4, humidity: 48, pressure: 1012.6, eco2: 640, tvoc: 35, air: 23, distance: 37.5, motion: 1, pressed: 0, ax: 0.42, ay: -0.13, az: 9.79, gx: 1.2, gy: -0.4, gz: 0.1, lux: 320, light: 64, moisture: 41, knob: 50, cpu_temp: 47.2, chip_temp: 26.8, uptime: 125, clock: '14:05' };
  function sampleValues() {
    const v = {};
    P().reads.forEach((r) => { v[r.name] = SAMPLE[r.k] != null ? SAMPLE[r.k] : 42; });
    return FM.applySteps(v, P().steps, null);
  }
  function previewText(tpl) {
    const bools = FM.programNames(A, P()).filter((n) => n.bool).map((n) => n.name);
    return FM.fillTemplate(tpl, sampleValues(), bools);
  }

  // ---------------- top bar ----------------
  function renderTop() {
    $('#boardSel').innerHTML = FM.boardOrder.map((id) => '<option value="' + id + '"' + (id === S.board ? ' selected' : '') + '>' + esc(FM.boards[id].name) + '</option>').join('');
    const langs = FM.langsFor(board());
    $('#langSel').innerHTML = langs.map((l) => '<option value="' + l + '"' + (l === lang() ? ' selected' : '') + '>' + FM.LANG_NAME[l] + '</option>').join('');
    $('#langSel').disabled = langs.length < 2;
    $('#projTitle').value = S.title || '';
    $('#modeLoop').classList.toggle('on', P().mode !== 'listen');
    $('#modeListen').classList.toggle('on', P().mode === 'listen');
    const hp = $('#helperPill');
    hp.classList.toggle('on', FM.helper.online);
    $('#helperText').textContent = FM.helper.online ? 'Helper connected' : 'Helper offline';
    const sp = $('#serialPill');
    sp.classList.toggle('on', FM.serial.connected);
    $('#serialText').textContent = FM.serial.connected ? 'USB board connected' : 'Connect USB board';
  }

  // ---------------- starters ----------------
  function renderStarters() {
    $('#starters').innerHTML = FM.templates.map((t) => {
      const off = t.family && t.family !== board().family;
      return '<button type="button" class="starter' + (S.starter === t.id ? ' current' : '') + '" data-tpl="' + t.id + '"' + (off ? ' title="Needs a Raspberry Pi"' : '') + '>' +
        '<span class="icons">' + (t.parts.length ? t.parts.map((id) => FM.icon(FM.parts[id], 40)).join('') : FM.boardIcon(40)) + '</span>' +
        '<strong>' + esc(t.title) + '</strong><p>' + esc(t.desc) + '</p>' + (off ? '<span class="tag">Raspberry Pi only</span>' : '') + '</button>';
    }).join('');
  }

  function useTemplate(id) {
    const t = FM.templates.find((x) => x.id === id);
    const snap = snapshot();
    if (t.family && t.family !== board().family) S.board = FM.boardOrder.find((b) => FM.boards[b].family === t.family);
    const r = FM.loadTemplate(t, board());
    S.build = r.build; S.program = r.program; S.title = r.title; S.starter = t.id; S.codeEdited = false;
    FM.sim.reset();
    S.sel = r.build[0] ? r.build[0].uid : null;
    render();
    toast('Loaded "' + t.title + '". Your previous parts and program were replaced.', () => restore(snap));
  }

  // ---------------- gallery ----------------
  function renderGallery() {
    $('#catFilters').innerHTML = FM.CATEGORIES.map(([k, l]) => '<button type="button" class="chip' + (S.cat === k ? ' on' : '') + '" data-cat="' + k + '">' + esc(l) + '</button>').join('');
    const q = (S.q || '').toLowerCase();
    const list = FM.partOrder.map((id) => FM.parts[id]).filter((p) => (S.cat === 'all' || p.cat === S.cat) && (!q || (p.name + ' ' + p.desc + ' ' + p.iface + ' ' + p.id).toLowerCase().includes(q)));
    const selId = S.sel && A.byUid[S.sel] ? A.byUid[S.sel].def.id : (S.sel || '').replace('part:', '');
    $('#gallery').innerHTML = list.map((p) => {
      const n = instsOf(p.id).length;
      const off = !p.families.includes(board().family);
      return '<button type="button" class="tile' + (selId === p.id ? ' sel' : '') + (off ? ' off' : '') + '" data-part="' + p.id + '" title="' + esc(p.desc) + '">' +
        (n ? '<span class="count" aria-label="' + n + ' connected">' + n + '</span>' : '') + FM.icon(p, 68) + '<span>' + esc(p.name) + '</span><span class="iface">' + esc(p.iface) + '</span></button>';
    }).join('') || '<p class="muted small">No parts match. Try another word.</p>';
  }

  function clickPart(id) {
    const p = FM.parts[id];
    const have = instsOf(id);
    if (!p.families.includes(board().family)) { S.sel = 'part:' + id; render(); return; }
    if (have.length) { S.sel = have[0].uid; render(); return; }
    addPart(id);
    render();
    const i = A.byUid[S.sel];
    toast('Connected ' + p.name + (i && i.wires.length ? ' — see the wires on the right.' : '.'));
  }

  // ---------------- "what it can do" ----------------
  function wireList(i) {
    if (!i.wires.length) return i.def.port ? '<p class="small">Plugs into the <b>' + esc({ usb: 'USB', hdmi: 'HDMI', jack: 'audio jack', csi: 'camera' }[i.def.port]) + '</b> socket. No pins needed.</p>' : '';
    return '<ul class="wires">' + i.wires.map((w) => '<li><span class="wdot" style="background:' + (w.color ? w.color[0] : 'transparent') + '" title="' + (w.color ? w.color[1] + ' wire' : '') + '"></span><span>' + esc(w.devPin) + '</span><span class="arrow">→</span><span class="to">' + esc(w.to) + (w.shared ? '<span class="shared">shared</span>' : '') + '</span></li>').join('') + '</ul>';
  }
  function instNotes(i) {
    const out = [];
    (i.def.extra || []).forEach((x) => out.push('<p class="note tip">You also need: ' + esc(x) + '</p>'));
    i.def.notes.concat(i.notes).forEach((n) => out.push('<p class="note ' + (n.startsWith('⚠') ? 'warn' : 'tip') + '">' + esc(n) + '</p>'));
    if (!i.supported) out.push('<p class="note bad">' + esc(i.def.name) + ' does not work with ' + esc(board().name) + '.</p>');
    return out.join('');
  }

  function renderAbility() {
    const el = $('#ability');
    let i = S.sel && A.byUid[S.sel];
    let def = i ? i.def : S.sel && S.sel.startsWith('part:') ? FM.parts[S.sel.slice(5)] : null;
    if (!def) { el.innerHTML = boardAbilities(); return; }
    const off = !def.families.includes(board().family);
    const insts = instsOf(def.id);
    let h = '<div class="ability-head">' + FM.icon(def, 96) + '<div><span class="eyebrow">What it can do</span><h2>' + esc(def.name) + '</h2><p>' + esc(def.desc) + '</p>' +
      '<div class="line" style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><span class="tag">' + esc(def.iface) + '</span>' + (def.power ? '<span class="tag">' + (def.power === 'v5' ? '5 V' : def.power === 'v3' ? '3.3 V' : '3.3 or 5 V') + '</span>' : '') + (def.addr ? '<span class="tag">I2C ' + FM.hex(i && i.addr != null ? i.addr : def.addr) + '</span>' : '') + '</div></div></div>';
    if (off) return (el.innerHTML = h + '<p class="note bad">This part needs a ' + (def.families.includes('pi') && def.families.length === 1 ? 'Raspberry Pi' : def.families.map((f) => FM.FAMILY[f].name).join(', ') + ' board') + '. Change the board at the top to use it.</p>');
    h += '<div class="in-build">' + insts.map((x) => '<span class="inst-chip' + (i && x.uid === i.uid ? ' sel' : '') + '" data-sel="' + x.uid + '">' + esc(x.short) + '<button type="button" class="x" data-remove="' + x.uid + '" aria-label="Remove ' + esc(x.label) + '">×</button></span>').join('') +
      '<button type="button" class="btn small" data-addpart="' + def.id + '">' + (insts.length ? '+ Add another' : '+ Connect') + '</button></div>';
    if (!i) return (el.innerHTML = h + '<p class="muted small">Connect it to see its wiring and add it to your program.</p>');
    if (def.values.length) {
      h += '<div class="section-title read">Read</div><div class="channels">' + def.values.filter((v) => !v.text).map((v) => {
        const on = P().reads.some((r) => r.uid === i.uid && r.k === v.k);
        return '<button type="button" class="channel' + (on ? ' on' : '') + '" data-read="' + i.uid + '|' + v.k + '">' + esc(v.l) + ' <span class="u">' + esc(v.u) + '</span></button>';
      }).join('') + '</div><p class="small muted" style="margin:6px 0 0">Tap a value to use it in the program. Tap again to stop reading it.</p>';
    }
    if (def.mic) h += '<div class="section-title read">Listen</div><button type="button" class="btn" data-usevoice="1">Use it for voice commands</button>';
    if ((def.actions || []).length) {
      h += '<div class="section-title do">Do</div><div class="actions-list">' + def.actions.map((a) => '<button type="button" class="btn" data-addact="' + i.uid + '|' + a.k + '">+ ' + esc(a.l) + '</button>').join('') + '</div>';
    }
    h += '<div class="section-title wire">Wiring</div>' + wireList(i) + instNotes(i);
    el.innerHTML = h;
  }

  function boardAbilities() {
    const b = board();
    const sys = FM.sysValues(b);
    let h = '<div class="ability-head">' + FM.boardIcon(96) + '<div><span class="eyebrow">What it can do</span><h2>' + esc(b.name) + '</h2><p>' + esc(b.blurb) + '</p></div></div>';
    h += '<div class="section-title read">Read (no parts needed)</div><div class="channels">' + sys.filter((v) => !v.text || v.k === 'clock').map((v) => {
      const on = P().reads.some((r) => r.uid === 'sys' && r.k === v.k);
      return '<button type="button" class="channel' + (on ? ' on' : '') + '" data-read="sys|' + v.k + '">' + esc(v.l) + ' <span class="u">' + esc(v.u) + '</span></button>';
    }).join('') + '</div>';
    h += '<div class="section-title do">Do</div><div class="actions-list">' + FM.builtinOutputs(b, lang()).map((o) => '<button type="button" class="btn" data-addact="' + o.uid + '|' + o.act + '">+ ' + esc(o.name) + '</button>').join('') + '</div>';
    h += '<p class="small muted" style="margin-top:14px">Tap a part on the left to connect it and see what it can read and do.</p>';
    return h;
  }

  function toggleRead(uid, k) {
    const ix = P().reads.findIndex((r) => r.uid === uid && r.k === k);
    if (ix >= 0) P().reads.splice(ix, 1);
    else {
      if (P().mode === 'listen') P().mode = 'loop';
      P().reads.push({ uid, k, name: FM.uniqueName(P(), k) });
    }
    S.starter = null;
    render();
  }

  const ACT_DEFAULTS = { say: { when: 'alert', every: 60 }, beep: { when: 'alert', every: 10, n: 3 }, photo: { when: 'alert', every: 30 }, blink: { when: 'alert', every: 0, n: 3 }, show: { when: 'always', every: 0 }, print: { when: 'always', every: 0 }, log: { when: 'always', every: 0 }, onwhile: { when: 'always' }, angle: { when: 'always', angle: 90, angle2: 0 }, follow: { when: 'always', min: 0, max: 100 }, colour: { when: 'always', colour: '#ff3b30', colour2: '#00c853' }, number: { when: 'always' }, turn: { when: 'alert', every: 30, steps: 512 } };
  function addAction(uid, act) {
    if (P().mode === 'listen') { // in listen mode, a speaker or screen becomes a reply channel
      if (act === 'say' || act === 'show' || act === 'print') { if (!P().listen.replies.includes(uid)) P().listen.replies.push(uid); render(); toast('Replies will also go to this part.'); return; }
      P().mode = 'loop';
    }
    const hasLimit = P().steps.some((s) => s.t === 'limit');
    const a = Object.assign({ id: FM.uid(), uid, act, every: 0, msg: '' }, JSON.parse(JSON.stringify(ACT_DEFAULTS[act] || { when: 'always' })));
    if (!hasLimit && a.when === 'alert') a.when = 'always';
    const names = FM.programNames(A, P());
    if (['follow', 'number'].includes(act)) {
      if (!names.length) { toast('First pick a reading to use, for example tap CO₂ on a sensor.'); return; }
      a.key = names[0].name;
    }
    P().actions.push(a);
    S.starter = null;
    render();
    toast('Added to the Do column of your program.');
  }

  // ---------------- program flow ----------------
  const OPS = [['>', 'is above'], ['<', 'is below'], ['>=', 'is at least'], ['<=', 'is at most'], ['==', 'equals']];
  const MATH = [['+', 'plus'], ['-', 'minus'], ['*', 'times'], ['/', 'divided by'], ['round', 'rounded to (digits)'], ['abs', 'without minus sign'], ['map', 'rescaled']];

  function sel(path, value, options, attrs) {
    return '<select data-bind="' + path + '" ' + (attrs || '') + '>' + options.map(([v, l]) => '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
  }
  const num = (path, value, attrs) => '<input type="number" data-bind="' + path + '" data-num="1" value="' + esc(value == null ? '' : value) + '" ' + (attrs || '') + '>';
  const txt = (path, value, attrs) => '<input type="text" data-bind="' + path + '" value="' + esc(value == null ? '' : value) + '" ' + (attrs || '') + '>';

  function nameOptions() { return FM.programNames(A, P()).map((n) => [n.name, '{' + n.name + '}' + (n.unit && !n.bool ? ' ' + n.unit : '')]); }

  function adder(id, label, body) {
    return '<div class="adder"><button type="button" class="btn" data-picker="' + id + '">' + label + '</button>' + (ui.picker === id ? '<div class="picker" role="menu">' + body + '</div>' : '') + '</div>';
  }

  function renderFlow() {
    const el = $('#flow');
    if (P().mode === 'listen') { el.innerHTML = listenFlow(); requestAnimationFrame(drawWires); return; }
    const names = nameOptions();
    const prog = P();
    // ---- Read lane ----
    let read = '<div class="lane read"><div class="lane-head"><h3><i>1</i>Read</h3><span class="small muted">every ' + num('interval', prog.interval, 'min="0.1" step="0.1" aria-label="Seconds between readings"') + ' s</span></div>';
    if (!prog.reads.length) read += '<div class="empty">Pick something to read: tap a value on a part above, or use the button below.</div>';
    prog.reads.forEach((r, k) => {
      const m = FM.valueMeta(A, r);
      const inst = r.uid === 'sys' ? null : A.byUid[r.uid];
      read += '<div class="block" data-node="r' + k + '"><span class="port r"></span><div class="block-head">' + (inst ? FM.icon(inst.def, 36) : FM.boardIcon(36)) + '<span class="t">' + esc(m ? m.l : r.k) + '<small>' + esc(inst ? inst.short : board().short) + (m && m.u ? ' · ' + esc(m.u) : '') + '</small></span><button type="button" class="x" data-del="reads.' + k + '" aria-label="Stop reading">×</button></div>' +
        '<div class="line"><span>call it</span><span class="mono">{</span><input type="text" data-rename="' + k + '" value="' + esc(r.name) + '" size="10" aria-label="Name"><span class="mono">}</span></div></div>';
    });
    const pick = [];
    A.inst.filter((i) => i.supported && i.def.values.some((v) => !v.text)).forEach((i) => {
      pick.push('<div class="grp">' + esc(i.label) + '</div>' + i.def.values.filter((v) => !v.text).map((v) => '<button type="button" data-read="' + i.uid + '|' + v.k + '">' + esc(v.l) + '<small>' + esc(v.u) + (prog.reads.some((r) => r.uid === i.uid && r.k === v.k) ? ' ✓' : '') + '</small></button>').join(''));
    });
    pick.push('<div class="grp">' + esc(board().short) + ' itself</div>' + FM.sysValues(board()).map((v) => '<button type="button" data-read="sys|' + v.k + '">' + esc(v.l) + '<small>' + esc(v.u) + '</small></button>').join(''));
    pick.push('<div class="grp">Need a sensor?</div><button type="button" data-goto="parts">Connect one in Parts ↑</button>');
    read += adder('read', '+ Read something', pick.join('')) + '</div>';

    // ---- Change lane ----
    let ch = '<div class="lane change"><div class="lane-head"><h3><i>2</i>Change</h3><span class="small muted">optional</span></div>';
    if (!prog.steps.length) ch += '<div class="empty" data-node="s-empty">Nothing to change. Values go straight through. You can do maths, smooth noisy readings, or check a limit.</div>';
    prog.steps.forEach((s, k) => {
      const p = 'steps.' + k;
      let body = '';
      if (s.t === 'math') {
        body = '<div class="block-head"><span class="t">Do maths</span><button type="button" class="x" data-del="' + p + '" aria-label="Remove">×</button></div>' +
          '<div class="line"><span>new value</span><span class="mono">{</span>' + txt(p + '.target', s.target, 'size="8" data-change-render="1" aria-label="New value name"') + '<span class="mono">}</span><span>=</span>' + sel(p + '.a', s.a, names.filter((n) => n[0] !== s.target)) + sel(p + '.op', s.op, MATH) + (['abs'].includes(s.op) ? '' : num(p + '.b', s.b, 'step="any" aria-label="Number"')) + '</div>' +
          (s.op === 'map' ? '<div class="line"><span>from</span>' + num(p + '.b', s.b) + '<span>–</span>' + num(p + '.b2', s.b2 == null ? 100 : s.b2) + '<span>to</span>' + num(p + '.c1', s.c1 || 0) + '<span>–</span>' + num(p + '.c2', s.c2 == null ? 100 : s.c2) + '</div>' : '');
      } else if (s.t === 'smooth') {
        body = '<div class="block-head"><span class="t">Smooth</span><button type="button" class="x" data-del="' + p + '" aria-label="Remove">×</button></div><div class="line"><span>average</span>' + sel(p + '.key', s.key, names) + '<span>over the last</span>' + num(p + '.n', s.n || 5, 'min="2" max="60"') + '<span>readings</span></div>';
      } else if (s.t === 'convert') {
        body = '<div class="block-head"><span class="t">°C to °F</span><button type="button" class="x" data-del="' + p + '" aria-label="Remove">×</button></div><div class="line"><span>turn</span>' + sel(p + '.key', s.key, names) + '<span>into Fahrenheit</span></div>';
      } else if (s.t === 'limit') {
        const meta = FM.programNames(A, prog).find((n) => n.name === s.key);
        const ops = meta && meta.bool ? [['yes', 'is yes'], ['no', 'is no']] : OPS;
        body = '<div class="block-head"><span class="t">Check<small>outputs can run only when this is true</small></span><button type="button" class="x" data-del="' + p + '" aria-label="Remove">×</button></div><div class="line"><span>when</span>' + sel(p + '.key', s.key, names, 'data-change-render="1"') + sel(p + '.op', s.op, ops) + (meta && meta.bool ? '' : num(p + '.val', s.val, 'step="any"')) + '</div>';
      }
      ch += '<div class="block" data-node="s' + k + '"><span class="port l"></span><span class="port r"></span>' + body + '</div>';
    });
    const hasLimit = prog.steps.some((s) => s.t === 'limit');
    const noNames = !names.length;
    ch += adder('step', '+ Add a step', noNames ? '<p class="small muted" style="margin:6px">Read something first, then you can change it here.</p>' :
      '<button type="button" data-step="math">Do maths<small>e.g. x ÷ 9.81</small></button><button type="button" data-step="smooth">Smooth noisy readings<small>average</small></button><button type="button" data-step="convert">Celsius to Fahrenheit</button>' +
      (hasLimit ? '' : '<button type="button" data-step="limit">Check a limit<small>e.g. CO₂ above 1000</small></button>')) + '</div>';

    // ---- Do lane ----
    let dl = '<div class="lane do"><div class="lane-head"><h3><i>3</i>Do</h3><span class="small muted">show, say or switch</span></div>';
    if (!prog.actions.length) dl += '<div class="empty">Choose what happens with the values: print them, show them on a screen, say them out loud, or switch something on.</div>';
    prog.actions.forEach((a, k) => { dl += actionBlock(a, k, names, hasLimit); });
    dl += adder('do', '+ Add an output', outputPicker()) + '</div>';

    el.innerHTML = '<svg class="wiresvg" aria-hidden="true"></svg>' + read + ch + dl;
    requestAnimationFrame(drawWires);
  }

  function actionBlock(a, k, names, hasLimit) {
    const p = 'actions.' + k;
    const inst = FM.actionTarget(A, a);
    const builtin = FM.builtinOutputs(board(), lang()).find((o) => o.uid === a.uid);
    const def = inst ? (inst.def.actions || []).find((x) => x.k === a.act) : null;
    const title = inst ? (def ? def.l : a.act) : builtin ? builtin.name : a.act;
    const isMsg = builtin ? builtin.msg : def && def.msg;
    let h = '<div class="block" data-node="a' + k + '"><span class="port l"></span><div class="block-head">' + (inst ? FM.icon(inst.def, 36) : FM.boardIcon(36)) + '<span class="t">' + esc(title) + '<small>' + esc(inst ? inst.short : board().short) + '</small></span><button type="button" class="x" data-del="' + p + '" aria-label="Remove">×</button></div>';
    if (isMsg) {
      const tpl = a.msg || FM.defaultMessage(A, P());
      h += '<input type="text" class="tpl" data-bind="' + p + '.msg" value="' + esc(tpl) + '" aria-label="Message">' +
        '<div class="namechips">' + names.map((n) => '<button type="button" class="namechip" data-insert="' + k + '|' + n[0] + '">{' + esc(n[0]) + '}</button>').join('') + '</div>' +
        '<div class="preview" data-preview="' + k + '">' + esc(previewText(tpl)) + '</div>';
    }
    const followsCheck = a.act === 'onwhile' || a.act === 'colour' || (a.act === 'angle' && hasLimit);
    if (a.act === 'angle') h += '<div class="line"><span>' + (hasLimit ? 'when the check is true, go to' : 'go to') + '</span>' + num(p + '.angle', a.angle, 'min="0" max="180"') + '<span>°</span>' + (hasLimit ? '<span>otherwise</span>' + num(p + '.angle2', a.angle2, 'min="0" max="180"') + '<span>°</span>' : '') + '</div>';
    if (a.act === 'follow') h += '<div class="line"><span>point at</span>' + sel(p + '.key', a.key, names) + '</div><div class="line"><span>0° at</span>' + num(p + '.min', a.min, 'step="any"') + '<span>180° at</span>' + num(p + '.max', a.max, 'step="any"') + '</div>';
    if (a.act === 'number') h += '<div class="line"><span>show</span>' + sel(p + '.key', a.key, names) + '</div>';
    if (a.act === 'colour') h += '<div class="line"><span>' + (hasLimit ? 'check true' : 'colour') + '</span><input type="color" data-bind="' + p + '.colour" value="' + esc(a.colour || '#ff3b30') + '" aria-label="Colour">' + (hasLimit ? '<span>otherwise</span><input type="color" data-bind="' + p + '.colour2" value="' + esc(a.colour2 || '#000000') + '" aria-label="Other colour">' : '') + '</div>';
    if (a.act === 'beep' || a.act === 'blink') h += '<div class="line">' + num(p + '.n', a.n || 3, 'min="1" max="20"') + '<span>times</span></div>';
    if (a.act === 'turn') h += '<div class="line"><span>turn</span>' + num(p + '.steps', a.steps || 512) + '<span>steps (4096 = one turn)</span></div>';
    if (a.act === 'onwhile') h += '<p class="small muted" style="margin:0">' + (hasLimit ? 'On while the check is true, off otherwise.' : 'Add a Check step to decide when it is on. For now it stays on.') + '</p>';
    if (!followsCheck && !['follow', 'number'].includes(a.act)) {
      h += '<div class="line">' + (hasLimit ? sel(p + '.when', a.when, [['always', 'every reading'], ['alert', 'only when the check is true'], ['calm', 'only when the check is false']], 'data-change-render="1"') : '<span>every reading</span>') +
        '<span>at most every</span>' + num(p + '.every', a.every || 0, 'min="0" aria-label="Seconds"') + '<span>s</span></div>';
    }
    return h + '</div>';
  }

  function outputPicker() {
    const out = [];
    out.push('<div class="grp">' + esc(board().short) + ' itself</div>' + FM.builtinOutputs(board(), lang()).map((o) => '<button type="button" data-addact="' + o.uid + '|' + o.act + '">' + esc(o.name) + '</button>').join(''));
    A.inst.filter((i) => i.supported && (i.def.actions || []).length).forEach((i) => {
      out.push('<div class="grp">' + esc(i.label) + '</div>' + i.def.actions.map((a) => '<button type="button" data-addact="' + i.uid + '|' + a.k + '">' + esc(a.l) + '</button>').join(''));
    });
    // Suggest hardware you could add, e.g. a speaker when there is no screen.
    const sugg = [];
    if (board().family === 'pi' && !hasAudio()) sugg.push('<button type="button" data-suggest="usbspk|say">Say it out loud<small>adds a USB speaker</small></button>');
    if (!hasScreen()) sugg.push('<button type="button" data-suggest="oled|show">Show it on a screen<small>adds an OLED</small></button>');
    if (!instsOf('led').length) sugg.push('<button type="button" data-suggest="led|onwhile">Light an LED<small>adds an LED</small></button>');
    if (!instsOf('buzzer').length) sugg.push('<button type="button" data-suggest="buzzer|beep">Beep<small>adds a buzzer</small></button>');
    if (sugg.length) out.push('<div class="grp">Add hardware for it</div>' + sugg.join(''));
    return out.join('');
  }

  // ---- listen mode ----
  function listenFlow() {
    const L = P().listen;
    const isPi = board().family === 'pi';
    const mic = instsOf('usbmic')[0];
    let hear = '<div class="lane read"><div class="lane-head"><h3><i>1</i>Hear</h3></div><div class="block" data-node="hear"><span class="port r"></span>' +
      '<label class="line"><input type="radio" name="via" data-via="typed"' + (L.via !== 'voice' ? ' checked' : '') + '> <b>Typed</b> <span>' + (isPi ? 'in the terminal' : 'in the serial monitor') + '</span></label>' +
      (isPi ? '<label class="line"><input type="radio" name="via" data-via="voice"' + (L.via === 'voice' ? ' checked' : '') + '> <b>Spoken</b> <span>through a USB microphone, works offline</span></label>' : '<p class="small muted" style="margin:0">Voice commands need a Raspberry Pi.</p>') +
      (L.via === 'voice' && !mic ? '<p class="note warn">Voice needs a USB microphone. <button type="button" class="btn small" data-addpart="usbmic">Connect a USB mic</button></p>' : '') + '</div></div>';

    const valueOpts = [];
    A.inst.filter((i) => i.supported).forEach((i) => i.def.values.filter((v) => !v.text).forEach((v) => valueOpts.push([i.uid + '|' + v.k, i.short + ': ' + v.l])));
    FM.sysValues(board()).filter((v) => !v.text).forEach((v) => valueOpts.push(['sys|' + v.k, board().short + ': ' + v.l]));
    const switchable = A.inst.filter((i) => i.supported && ['led', 'relay', 'buzzer'].includes(i.def.id));
    const cams = A.inst.filter((i) => i.supported && i.def.id === 'camera');
    const DO = [['time', isPi ? 'say the time' : 'say how long it has run'], ['text', 'say some text'], ['reading', 'say a reading']].concat(switchable.length ? [['on', 'switch something on'], ['off', 'switch something off']] : []).concat(cams.length ? [['photo', 'take a photo']] : []).concat([['stop', 'stop listening']]);

    let rules = '<div class="lane change"><div class="lane-head"><h3><i>2</i>Decide</h3><span class="small muted">first match wins</span></div>';
    if (!L.rules.length) rules += '<div class="empty" data-node="s-empty">Add a command, for example: when I say "time", say the time.</div>';
    L.rules.forEach((r, k) => {
      const p = 'listen.rules.' + k;
      rules += '<div class="block" data-node="s' + k + '"><span class="port l"></span><span class="port r"></span><div class="block-head"><span class="t">Command</span><button type="button" class="x" data-del="' + p + '" aria-label="Remove">×</button></div>' +
        '<div class="line"><span>when I say</span>' + txt(p + '.say', r.say, 'size="16" aria-label="Words"') + '</div><div class="line"><span>then</span>' + sel(p + '.do', r.do, DO, 'data-change-render="1"') + '</div>';
      if (r.do === 'text') rules += '<div class="line">' + txt(p + '.text', r.text, 'size="24" aria-label="Text to say"') + '</div>';
      if (r.do === 'reading') rules += '<div class="line">' + sel(p + '.src', (r.uid || '') + '|' + (r.k || ''), valueOpts.length ? valueOpts : [['', 'connect a sensor first']], 'data-src="' + k + '"') + '</div><div class="line"><span>reply</span>' + txt(p + '.text', r.text || '{value}', 'size="24" aria-label="Reply"') + '</div>';
      if (r.do === 'on' || r.do === 'off') rules += '<div class="line">' + sel(p + '.uid', r.uid, switchable.map((i) => [i.uid, i.short])) + '</div>';
      if (r.do === 'photo') rules += '<div class="line">' + sel(p + '.uid', r.uid, cams.map((i) => [i.uid, i.short])) + '</div>';
      rules += '<p class="small muted" style="margin:0">Separate several words with commas.</p></div>';
    });
    rules += '<div class="adder"><button type="button" class="btn" data-addrule="1">+ Add a command</button></div></div>';

    const replyOpts = [['print', isPi ? 'Print in the terminal' : 'Print to the serial monitor']];
    A.inst.filter((i) => i.supported && (i.def.audio || ['oled', 'lcd1602'].includes(i.def.id))).forEach((i) => replyOpts.push([i.uid, (i.def.audio ? 'Say it with ' : 'Show on ') + i.short]));
    let rep = '<div class="lane do"><div class="lane-head"><h3><i>3</i>Reply</h3></div><div class="block" data-node="a0"><span class="port l"></span>' +
      replyOpts.map(([v, l]) => '<label class="line"><input type="checkbox" data-reply="' + v + '"' + (L.replies.includes(v) ? ' checked' : '') + '> ' + esc(l) + '</label>').join('') +
      (isPi && !hasAudio() ? '<p class="small muted" style="margin:0">No speaker yet. <button type="button" class="btn small" data-addpart="usbspk">Connect a USB speaker</button></p>' : '') + '</div></div>';
    return '<svg class="wiresvg" aria-hidden="true"></svg>' + hear + rules + rep;
  }

  // Curved wires between blocks: every input feeds the first step, steps feed each other, the last step feeds every output.
  function drawWires() {
    const flow = $('#flow');
    const svg = $('svg.wiresvg', flow);
    if (!svg) return;
    const box = flow.getBoundingClientRect();
    const node = (n) => $('[data-node="' + n + '"]', flow);
    const ins = $$('.lane.read [data-node]', flow), mids = $$('.lane.change [data-node]', flow), outs = $$('.lane.do [data-node]', flow);
    const pairs = [];
    const firstMid = mids[0], lastMid = mids[mids.length - 1];
    ins.forEach((i) => firstMid && pairs.push([i, firstMid, 'read']));
    for (let k = 0; k + 1 < mids.length; k++) pairs.push([mids[k], mids[k + 1], 'change']);
    outs.forEach((o) => lastMid && pairs.push([lastMid, o, 'do']));
    const stroke = { read: 'var(--read)', change: 'var(--change)', do: 'var(--do)' };
    svg.innerHTML = pairs.map(([a, b, kind]) => {
      const r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
      let d;
      if (r2.left > r1.right - 4) {
        const x1 = r1.right - box.left, y1 = r1.top + r1.height / 2 - box.top, x2 = r2.left - box.left, y2 = r2.top + r2.height / 2 - box.top;
        const mx = (x1 + x2) / 2;
        d = 'M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2;
      } else {
        const x1 = r1.left + Math.min(28, r1.width / 2) - box.left, y1 = r1.bottom - box.top, x2 = r2.left + Math.min(28, r2.width / 2) - box.left, y2 = r2.top - box.top;
        const my = (y1 + y2) / 2;
        d = 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + my + ' ' + x2 + ' ' + my + ' ' + x2 + ' ' + y2;
      }
      return '<path d="' + d + '" fill="none" stroke="' + stroke[kind] + '" stroke-width="2.2" stroke-linecap="round" opacity=".75"/>';
    }).join('');
    void node;
  }

  // ---------------- board & pins ----------------
  function renderBoard() {
    const b = board();
    const el = $('#board');
    const focus = S.sel && A.byUid[S.sel] ? A.byUid[S.sel] : null;
    const focusPins = focus ? new Set(Object.values(focus.pins)) : null;
    const used = Object.keys(A.use).filter((id) => A.use[id].length && !['gnd', 'v3', 'v5', 'vin'].includes(b.pins[id].type));
    const parts = A.inst.filter((i) => i.supported).length;
    let h = '<div class="panel-head"><h2 id="boardTitle">Wiring</h2><p>' + esc(b.name) + '. ' + (focus ? 'Showing the pins for <b>' + esc(focus.label) + '</b>. ' : '') + 'Tap any pin to learn what it does.</p></div>';
    h += '<div class="stats"><span><b>' + parts + '</b> parts</span><span><b>' + used.length + '</b> signal pins used</span><span><b>' + A.free.length + '</b> free pins</span>' + (A.rails.v3 || A.rails.v5 ? '<span><b>' + (A.rails.v3 + A.rails.v5) + '</b> mA estimated</span>' : '') + '</div>';
    A.warn.forEach((w) => { h += '<p class="note bad">' + esc(w) + '</p>'; });
    A.tips.forEach((w) => { h += '<p class="note tip">' + esc(w) + '</p>'; });
    h += boardSvg(b, focusPins);
    h += '<div class="pinmap"><div class="legend">' + ['v5', 'v3', 'gnd', 'gpio', 'i2c', 'spi', 'uart', 'pwm', 'adc', 'sys'].filter((t) => Object.values(b.pins).some((p) => p.type === t)).map((t) => '<span><i class="t-' + t + '"></i>' + FM.PIN_TYPES[t].short + '</span>').join('') + '<span><i style="background:transparent;box-shadow:0 0 0 2px #ffd9a8"></i>in use</span></div>';
    h += '<div class="pingrid' + (b.layout.kind === 'sides' ? ' sides' : '') + '">';
    const rows = Math.max(b.layout.left.length, b.layout.right.length);
    for (let r = 0; r < rows; r++) {
      const L = b.layout.left[r], R = b.layout.right[r];
      h += pinLabel(b, L, 'l') + pinCell(b, L, focusPins) + '<span class="' + (b.layout.kind === 'sides' ? 'midcol' : '') + '"></span>' + pinCell(b, R, focusPins) + pinLabel(b, R, 'r');
    }
    h += '</div><div class="pininfo" id="pinInfo">' + pinInfo(b, ui.pin) + '</div></div>';
    if (A.cmds.length || A.cfg.length) {
      h += '<div class="section-title wire">Turn on the interfaces once</div><div class="cmds">' + esc(A.cmds.concat(A.cfg.map((c) => 'echo "' + c + '" | sudo tee -a /boot/firmware/config.txt')).concat(A.cfg.length ? ['sudo reboot'] : []).join('\n')) + '</div>';
    }
    const wired = A.inst.filter((i) => i.supported);
    if (wired.length) {
      h += '<div class="section-title wire">Wire by wire</div><p class="note warn">Unplug the power before you connect wires. Connect GND first.</p><div class="allwires">' + wired.map((i) => '<div class="wirecard"><h3>' + FM.icon(i.def, 32) + esc(i.label) + (i.auto ? ' <span class="tag">added for you</span>' : '') + '</h3>' + wireList(i) + ((i.def.extra || []).length ? '<p class="note tip">Also: ' + esc(i.def.extra.join(', ')) + '</p>' : '') + i.notes.map((n) => '<p class="note ' + (n.startsWith('⚠') ? 'warn' : 'tip') + '">' + esc(n) + '</p>').join('') + '</div>').join('') + '</div>';
    }
    el.innerHTML = h;
  }

  function pinCell(b, id, focusPins) {
    if (!id) return '<span></span>';
    const p = b.pins[id];
    const users = (A.use[id] || []);
    const cls = 'pin t-' + p.type + (users.length ? ' used' : '') + (focusPins && !focusPins.has(id) ? ' dim' : '') + (ui.pin === id ? ' picked' : '');
    return '<button type="button" class="' + cls + '" data-pin="' + esc(id) + '" aria-label="' + esc(FM.pinRef(b, id)) + '">' + (b.refStyle === 'number' ? esc(id) : '') + '</button>';
  }
  function pinLabel(b, id, side) {
    if (!id) return '<span></span>';
    const p = b.pins[id];
    const users = (A.use[id] || []).filter((u) => !u.mirror);
    const who = users.length ? users.map((u) => u.label + ' ' + u.devPin).join(', ') : '';
    return '<span class="pinlabel ' + side + '"><span class="nm">' + esc(p.label) + '</span>' + (who ? '<span class="who" title="' + esc(who) + '">' + esc(who) + '</span>' : (p.fn && p.type !== 'gpio' ? '<span class="who" style="color:inherit;opacity:.65">' + esc(p.fn.split(' · ')[0]) + '</span>' : '')) + '</span>';
  }
  function pinInfo(b, id) {
    if (!id || !b.pins[id]) return 'Tap a pin to see what it is for and what is connected to it.';
    const p = b.pins[id], t = FM.PIN_TYPES[p.type];
    const users = (A.use[id] || []);
    return '<b>' + esc(FM.pinRef(b, id)) + '</b> — ' + esc(t.name) + (p.fn ? ' (' + esc(p.fn) + ')' : '') + '<br>' + esc(t.info) + (b.avoid[id] ? '<br>Avoid: ' + esc(b.avoid[id]) + '.' : '') + '<br>' + (users.length ? 'Connected: ' + esc(users.map((u) => u.label + ' → ' + u.devPin).join(', ')) : 'Nothing connected.');
  }

  function boardSvg(b, focusPins) {
    const o = b.outline;
    const pad = 30;
    let s = '<svg class="boardsvg" viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (o.w + pad * 2 + 40) + ' ' + (o.h + pad * 2) + '" role="img" aria-label="Drawing of the ' + esc(b.name) + ' and its sockets">';
    s += '<rect x="0" y="0" width="' + o.w + '" height="' + o.h + '" rx="18" fill="var(--board)"/>';
    const usedPorts = { usb: A.ports.usb.length, hdmi: A.ports.hdmi.length, jack: A.ports.jack.length, csi: A.ports.csi.length };
    const seen = {};
    b.ports.forEach((pt) => {
      seen[pt.k] = (seen[pt.k] || 0) + 1;
      const perRect = pt.k === 'usb' && b.family === 'pi' && b.id !== 'zero' ? 2 : 1;
      const on = usedPorts[pt.k] > (seen[pt.k] - 1) * perRect;
      s += '<rect x="' + pt.x + '" y="' + pt.y + '" width="' + pt.w + '" height="' + pt.h + '" rx="5" fill="' + (on ? 'var(--accent)' : '#b9c2bd') + '" stroke="#0005"' + (pt.dashed ? ' stroke-dasharray="6 4" fill-opacity=".35"' : '') + '/>';
      const vertical = pt.h > pt.w * 1.6;
      const cx = pt.x + pt.w / 2, cy = pt.y + pt.h / 2;
      s += '<text x="' + cx + '" y="' + cy + '" font-size="' + (b.family === 'pi' ? 20 : 15) + '" fill="' + (on ? '#fff' : '#1b2a22') + '" text-anchor="middle" dominant-baseline="middle"' + (vertical ? ' transform="rotate(-90 ' + cx + ' ' + cy + ')"' : '') + ' font-family="IBM Plex Sans, sans-serif">' + esc(pt.l) + '</text>';
    });
    if (b.layout.kind === 'paired' && o.header) {
      const hd = o.header;
      b.layout.left.forEach((id, k) => {
        [[id, 1], [b.layout.right[k], 0]].forEach(([pid, row]) => {
          const p = b.pins[pid];
          const x = hd.x + k * hd.pitch, y = hd.y + row * hd.pitch;
          const used = (A.use[pid] || []).length;
          s += '<rect x="' + x + '" y="' + y + '" width="18" height="18" rx="3" class="t-' + p.type + '" style="fill:var(--p-' + p.type + ')" stroke="' + (used ? '#ffd9a8' : '#0006') + '" stroke-width="' + (used ? 4 : 1) + '" opacity="' + (focusPins && !focusPins.has(pid) ? .3 : 1) + '"/>';
        });
      });
      s += '<text x="' + (o.header.x - 8) + '" y="' + (o.header.y + 40) + '" font-size="16" fill="var(--board-ink)" text-anchor="end" font-family="IBM Plex Mono, monospace">1</text>';
      s += '<text x="' + (o.header.x + 19 * o.header.pitch + 26) + '" y="' + (o.header.y + 14) + '" font-size="16" fill="var(--board-ink)" font-family="IBM Plex Mono, monospace">40</text>';
      s += '<rect x="250" y="190" width="150" height="150" rx="8" fill="#2a2f2c"/><text x="325" y="268" font-size="18" fill="#9aa3a0" text-anchor="middle" font-family="IBM Plex Mono, monospace">' + esc(b.chip.split(' ')[0]) + '</text>';
    } else {
      const step = (o.h - 60) / Math.max(b.layout.left.length, b.layout.right.length);
      [['left', 14], ['right', o.w - 30]].forEach(([side, x]) => {
        b.layout[side].forEach((pid, k) => {
          if (!pid) return;
          const p = b.pins[pid];
          const y = 30 + k * step;
          const used = (A.use[pid] || []).length;
          s += '<rect x="' + x + '" y="' + y + '" width="16" height="' + Math.min(16, step - 3) + '" rx="3" style="fill:var(--p-' + p.type + ')" stroke="' + (used ? '#ffd9a8' : '#0006') + '" stroke-width="' + (used ? 3 : 1) + '" opacity="' + (focusPins && !focusPins.has(pid) ? .3 : 1) + '"/>';
        });
      });
      s += '<rect x="' + (o.w / 2 - 45) + '" y="' + (o.h / 2 - 45) + '" width="90" height="90" rx="6" fill="#2a2f2c"/><text x="' + (o.w / 2) + '" y="' + (o.h / 2 + 5) + '" font-size="13" fill="#9aa3a0" text-anchor="middle" font-family="IBM Plex Mono, monospace">' + esc(b.chip.split(' ')[0]) + '</text>';
    }
    return s + '</svg>';
  }

  // ---------------- code ----------------
  function regenerate() {
    G = FM.generate(board(), S.build, P(), { title: S.title }, lang());
    A = G.A;
    if (!S.codeEdited) S.code = G.code;
  }

  function renderCode() {
    const el = $('#code');
    const tabs = [['code', 'Code'], ['libs', 'Libraries'], ['upload', 'Upload & run'], ['serial', 'Serial monitor']];
    let h = '<div class="panel-head"><h2 id="codeTitle">Code</h2><p>This is the real program. Read it, change it, copy it or send it to your board.</p></div>';
    h += '<div class="tabs" role="tablist">' + tabs.map(([k, l]) => '<button type="button" role="tab" aria-selected="' + (S.tab === k) + '" class="' + (S.tab === k ? 'on' : '') + '" data-tab="' + k + '">' + l + '</button>').join('') + '</div>';
    if (S.tab === 'code') {
      h += '<div class="codebar"><span class="file">' + esc(G.file) + ' · ' + FM.LANG_NAME[G.lang] + '</span><button type="button" class="btn small" data-copy="1">Copy</button>' + (inFrame ? '' : '<button type="button" class="btn small" data-download="1">Download</button>') + '<button type="button" class="btn small primary" data-tab="upload">Upload & run</button></div>';
      if (S.codeEdited) h += '<p class="note warn edited"><span>You edited the code, so changes to the blocks no longer update it.</span><button type="button" class="btn small" data-regen="1">Use the blocks again</button></p>';
      h += '<div class="editor"><textarea id="codeArea" spellcheck="false" aria-label="Program code">' + esc(S.code) + '</textarea></div>';
    } else if (S.tab === 'libs') h += libsTab();
    else if (S.tab === 'upload') h += uploadTab();
    else h += serialTab();
    el.innerHTML = h;
    const mon = $('#monitor');
    if (mon) mon.scrollTop = mon.scrollHeight;
  }

  function libStatus(l) {
    if (l.preinstalled) return '<span class="tag">comes with the OS</span>';
    return '<button type="button" class="btn small" data-install="' + l.id + '"' + (FM.helper.online ? '' : ' disabled title="Start the helper to install from here"') + '>Install</button>';
  }
  function libsTab() {
    const L = lang();
    const kinds = L === 'python' ? ['pip', 'apt'] : L === 'micropython' ? ['mip'] : ['arduino'];
    const needed = G.libs.map((id) => FM.libraries[id]).filter(Boolean).filter((l) => kinds.includes(l.kind));
    const q = ui.libQuery.toLowerCase();
    const all = Object.values(FM.libraries).filter((l) => kinds.includes(l.kind) && !needed.includes(l) && (!q || (l.name + l.pkg + l.desc).toLowerCase().includes(q)));
    const how = { pip: 'pip install', apt: 'sudo apt install', mip: 'mpremote mip install', arduino: 'arduino-cli lib install' };
    let h = '<p class="small muted">Libraries are ready-made code for a part. ' + (FM.helper.online ? 'The helper installs them for you.' : 'Start the helper to install with one click, or run the command shown.') + '</p>';
    h += '<div class="section-title do">This program needs</div><div class="libs">' + (needed.length ? needed.map((l) => '<div class="lib"><b>' + esc(l.name) + '</b><span class="side">' + libStatus(l) + '</span><p>' + esc(l.desc) + ' <span class="pkg">' + esc(how[l.kind] + ' ' + l.pkg) + '</span></p></div>').join('') : '<p class="small muted">Nothing extra. Everything used is built in.</p>') + '</div>';
    h += '<div class="section-title wire">Library catalog</div><input type="text" class="search" id="libSearch" placeholder="Search libraries" value="' + esc(ui.libQuery) + '" aria-label="Search libraries">';
    h += '<div class="libs">' + all.map((l) => '<div class="lib"><b>' + esc(l.name) + '</b><span class="side">' + libStatus(l) + '</span><p>' + esc(l.desc) + ' <span class="pkg">' + esc(l.pkg) + '</span></p></div>').join('') + '</div>';
    h += '<div class="section-title wire">Any other library</div><div class="sendline"><input type="text" id="customLib" placeholder="' + (L === 'arduino' ? 'Library name, e.g. Adafruit BMP280 Library' : L === 'micropython' ? 'Package, e.g. github:user/repo' : 'pip package name') + '" aria-label="Library name"><button type="button" class="btn" data-installcustom="1"' + (FM.helper.online ? '' : ' disabled') + '>Install</button></div>';
    return h;
  }

  function uploadTab() {
    const L = lang(), b = board();
    const helperLine = FM.helper.online ? '<p class="note tip">Helper connected' + (FM.helper.info && FM.helper.info.tools ? ': ' + esc(Object.entries(FM.helper.info.tools).filter(([, v]) => v).map(([k]) => k).join(', ') || 'no tools found') : '') + '.</p>'
      : '<p class="note warn">The helper is not running. Start it on this computer with <code>python3 helper/fm_helper.py</code> and open <code>http://localhost:8765</code>. <button type="button" class="btn small" data-checkhelper="1">Check again</button></p>';
    let h = '';
    if (L === 'python') {
      h += '<ol class="steps"><li>Wire the parts as shown under Wiring, with the Pi switched off.</li><li>Run the one-time setup commands at the top of the code in a terminal on the Pi.</li><li>Save the code as <code>program.py</code> and run <code>python3 program.py</code>.</li></ol>';
      h += '<div class="section-title do">Run it from here</div>' + helperLine + '<div class="line" style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn primary" data-runpi="1"' + (FM.helper.online ? '' : ' disabled') + '>Run on this Pi</button><button type="button" class="btn" data-stoppi="1"' + (FM.helper.online ? '' : ' disabled') + '>Stop</button></div><p class="small muted">Open this page on the Pi itself (with the helper running there) and the program runs on the Pi. Its output shows in the Serial monitor tab.</p>';
    } else if (L === 'micropython') {
      h += '<ol class="steps"><li>Install MicroPython on the board once: <a href="' + esc(b.firmware || 'https://micropython.org/download/') + '" target="_blank" rel="noopener">download the firmware</a>' + (b.family === 'pico' ? ' (hold BOOTSEL, plug in, drag the .uf2 file onto the drive).' : ' and flash it.') + '</li><li>Install the libraries listed in the Libraries tab, if any.</li><li>Plug the board in by USB and save the code as <code>main.py</code>.</li></ol>';
      h += '<div class="section-title do">Straight from the browser</div>' + (FM.serial.supported ? '<div class="line" style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn primary" data-mpupload="1">' + (FM.serial.connected ? 'Save main.py to the board' : 'Connect and save main.py') + '</button><button type="button" class="btn" data-mpstop="1"' + (FM.serial.connected ? '' : ' disabled') + '>Stop program</button></div><p class="small muted">Works in Chrome and Edge. The board restarts and runs the new code; watch it in the Serial monitor tab.</p>' : '<p class="note warn">This browser cannot reach USB boards. Use Chrome or Edge on a computer, or the helper below.</p>');
      h += '<div class="section-title wire">With the helper</div>' + helperLine + portPicker() + '<button type="button" class="btn" data-mphelper="1"' + (FM.helper.online ? '' : ' disabled') + '>Upload with mpremote</button>';
    } else {
      h += '<ol class="steps"><li>Install the libraries from the Libraries tab.</li><li>Pick the USB port of your ' + esc(b.short) + '.</li><li>Compile and upload. The board restarts and runs the sketch.</li></ol>';
      h += helperLine + portPicker() + '<div class="line" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="btn primary" data-ardupload="1"' + (FM.helper.online ? '' : ' disabled') + '>Compile and upload</button></div>';
      h += '<p class="small muted">Board type: <code>' + esc(b.fqbn || '') + '</code>. No helper? Copy the code into the Arduino IDE, install the same libraries with its Library Manager, and press Upload.</p>';
    }
    if (ui.busy) h += '<p class="note tip">' + esc(ui.busy) + '</p>';
    if (ui.uploadLog) h += '<div class="monitor" style="height:200px">' + esc(ui.uploadLog) + '</div>';
    return h;
  }
  function portPicker() {
    const ports = ui.ports || [];
    return '<div class="sendline"><select id="portSel" aria-label="USB port">' + (ports.length ? ports.map((p) => '<option value="' + esc(p.device) + '"' + (ui.port === p.device ? ' selected' : '') + '>' + esc(p.device + (p.description ? ' · ' + p.description : '') + (p.guess ? ' · ' + p.guess : '')) + '</option>').join('') : '<option value="">No ports found yet</option>') + '</select><button type="button" class="btn" data-ports="1"' + (FM.helper.online ? '' : ' disabled') + '>Find ports</button></div>';
  }
  function serialTab() {
    let h = '';
    if (!FM.serial.supported && !FM.helper.online) h += '<p class="note warn">This browser cannot open USB serial ports. Use Chrome or Edge.</p>';
    h += '<div class="line" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' + (FM.serial.connected ? '<button type="button" class="btn" data-serial="off">Disconnect</button>' : '<button type="button" class="btn primary" data-serial="on"' + (FM.serial.supported ? '' : ' disabled') + '>Connect a board</button>') + '<button type="button" class="btn ghost" data-clearmon="1">Clear</button></div>';
    if (FM.serial.connected) {
      const guess = FM.serial.guessBoards(FM.serial.info);
      if (guess.length) h += '<p class="note tip">This looks like ' + esc(guess[0].note) + '. ' + (guess.some((g) => g.board.id === S.board) ? '' : '<button type="button" class="btn small" data-setboard="' + guess[0].board.id + '">Switch to ' + esc(guess[0].board.short) + '</button>') + '</p>';
    }
    h += '<div class="monitor" id="monitor">' + esc(ui.monitor || (FM.serial.connected ? '' : 'Output from your board appears here.')) + '</div>';
    h += '<div class="sendline"><input type="text" id="sendText" placeholder="Type a command and press Enter" aria-label="Send to board"' + (FM.serial.connected ? '' : ' disabled') + '><button type="button" class="btn" data-send="1"' + (FM.serial.connected ? '' : ' disabled') + '>Send</button></div>';
    return h;
  }

  // ---------------- render ----------------
  function render() {
    regenerate();
    if (S.sel && !S.sel.startsWith('part:') && !A.byUid[S.sel]) S.sel = null;
    renderTop(); renderStarters(); renderGallery(); renderAbility(); renderFlow(); FM.sim.render(); renderBoard(); renderCode();
    save();
  }
  // Light refresh after typing: code, previews and wires, without rebuilding inputs.
  function refreshLight() {
    regenerate();
    if (S.tab === 'code' && !S.codeEdited) { const ta = $('#codeArea'); if (ta) ta.value = S.code; }
    $$('[data-preview]').forEach((el) => { const a = P().actions[+el.dataset.preview]; if (a) el.textContent = previewText(a.msg || FM.defaultMessage(A, P())); });
    drawWires();
    save();
  }

  // ---------------- events ----------------
  function renameRead(k, value) {
    const r = P().reads[k];
    const old = r.name;
    const name = FM.safeName(value);
    if (name === old) return;
    r.name = '__tmp';
    r.name = FM.uniqueName(P(), name);
    const nw = r.name;
    P().steps.forEach((s) => { if (s.key === old) s.key = nw; if (s.a === old) s.a = nw; });
    P().actions.forEach((a) => { if (a.key === old) a.key = nw; if (a.msg) a.msg = a.msg.split('{' + old + '}').join('{' + nw + '}'); });
    if (P().message) P().message = P().message.split('{' + old + '}').join('{' + nw + '}');
  }

  function bindEvents() {
    document.addEventListener('click', async (e) => {
      const t = e.target.closest('button, [data-sel]');
      if (!t) { if (ui.picker && !e.target.closest('.picker')) { ui.picker = null; renderFlow(); } return; }
      const d = t.dataset;
      if (d.tpl) return useTemplate(d.tpl);
      if (d.cat) { S.cat = d.cat; return renderGallery(); }
      if (d.part) return clickPart(d.part);
      if (d.remove) { e.stopPropagation(); return removeInst(d.remove); }
      if (d.sel && !d.remove) { S.sel = d.sel; return render(); }
      if (d.addpart) { addPart(d.addpart); render(); return toast('Connected ' + FM.parts[d.addpart].name + '.'); }
      if (d.read) { const [uid, k] = d.read.split('|'); ui.picker = null; return toggleRead(uid, k); }
      if (d.addact) { const [uid, act] = d.addact.split('|'); ui.picker = null; return addAction(uid, act); }
      if (d.suggest) { const [pid, act] = d.suggest.split('|'); ui.picker = null; const uid = addPart(pid, { select: false }); regenerate(); return addAction(uid, act); }
      if (d.usevoice) { P().mode = 'listen'; P().listen.via = 'voice'; render(); return document.getElementById('program').scrollIntoView({ behavior: 'smooth' }); }
      if (d.picker) { ui.picker = ui.picker === d.picker ? null : d.picker; return renderFlow(); }
      if (d.goto) { ui.picker = null; renderFlow(); return document.getElementById(d.goto).scrollIntoView({ behavior: 'smooth' }); }
      if (d.step) {
        ui.picker = null;
        const names = FM.programNames(A, P());
        const first = names.find((n) => !n.bool && !n.text) || names[0];
        const key = first ? first.name : '';
        if (d.step === 'math') P().steps.push({ t: 'math', target: FM.uniqueName(P(), key + '_new'), a: key, op: '*', b: 1 });
        if (d.step === 'smooth') P().steps.push({ t: 'smooth', key, n: 5 });
        if (d.step === 'convert') P().steps.push({ t: 'convert', key: (names.find((n) => /temp/.test(n.name)) || first).name });
        if (d.step === 'limit') { const b = names.find((n) => n.bool); P().steps.push(b && !first ? { t: 'limit', key: b.name, op: 'yes' } : { t: 'limit', key, op: '>', val: SAMPLE[(first && first.from && first.from.k) || ''] || 0 }); }
        S.starter = null;
        return render();
      }
      if (d.del) { const parts = d.del.split('.'); const ix = +parts.pop(); getPath(P(), parts.join('.')).splice(ix, 1); S.starter = null; return render(); }
      if (d.insert) {
        const [k, name] = d.insert.split('|');
        const input = $('[data-bind="actions.' + k + '.msg"]');
        const a = P().actions[+k];
        const cur = input ? input.value : a.msg;
        const pos = input && input.selectionStart != null ? input.selectionStart : cur.length;
        a.msg = cur.slice(0, pos) + '{' + name + '}' + cur.slice(pos);
        if (input) { input.value = a.msg; input.focus(); input.setSelectionRange(pos + name.length + 2, pos + name.length + 2); }
        return refreshLight();
      }
      if (d.addrule) { P().listen.rules.push({ id: FM.uid(), say: '', do: 'text', text: 'Hello!' }); return render(); }
      if (d.pin) { ui.pin = d.pin; $$('.pin.picked').forEach((p) => p.classList.remove('picked')); t.classList.add('picked'); $('#pinInfo').innerHTML = pinInfo(board(), d.pin); return; }
      if (d.tab) { S.tab = d.tab; if (d.tab === 'upload' && FM.helper.online && !ui.ports) refreshPorts(); renderCode(); if (t.closest('.codebar')) $('#code').scrollIntoView({ behavior: 'smooth' }); return save(); }
      if (d.copy) { const text = S.code; try { await navigator.clipboard.writeText(text); toast('Code copied.'); } catch (err) { const ta = $('#codeArea'); ta.focus(); ta.select(); toast('Press Ctrl+C (or Cmd+C) to copy the selected code.'); } return; }
      if (d.download) { const blob = new Blob([S.code], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = G.file; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); return; }
      if (d.regen) { S.codeEdited = false; return render(); }
      if (d.checkhelper) { await FM.helper.check(); return render(); }
      if (d.install || d.installcustom) {
        let lib = d.install ? FM.libraries[d.install] : null;
        if (!lib) { const name = ($('#customLib').value || '').trim(); if (!name) return toast('Type a library name first.'); const kind = { python: 'pip', micropython: 'mip', arduino: 'arduino' }[lang()]; lib = { kind, pkg: name, name }; }
        t.disabled = true; t.textContent = 'Installing…';
        try { const r = await FM.helper.installLib(lib, ui.port); toast(lib.name + ' installed.'); appendMonitor((r.output || '') + '\n'); t.textContent = 'Installed'; }
        catch (err) { toast('Install failed: ' + err.message); t.disabled = false; t.textContent = 'Install'; }
        return;
      }
      if (d.ports) return refreshPorts();
      if (d.serial === 'on') return connectSerial();
      if (d.serial === 'off') { await FM.serial.disconnect(); return render(); }
      if (d.clearmon) { ui.monitor = ''; return renderCode(); }
      if (d.send) return sendLine();
      if (d.setboard) { S.board = d.setboard; S.lang = null; return render(); }
      if (d.mpupload) return mpUpload();
      if (d.mpstop) { try { await FM.serial.stopProgram(); toast('Stopped.'); } catch (err) { toast(err.message); } return; }
      if (d.mphelper) return helperTask('Uploading with mpremote…', () => FM.helper.uploadMicroPython(S.code, selectedPort()));
      if (d.ardupload) return helperTask('Compiling and uploading. The first time can take a few minutes while board files download…', () => FM.helper.uploadArduino(S.code, board().fqbn, selectedPort(), FM.safeName(S.title || 'sketch')));
      if (d.runpi) return helperTask('Starting the program on the Pi…', () => FM.helper.runPython(S.code), true);
      if (d.stoppi) return helperTask('Stopping…', () => FM.helper.stopPython());
    });

    document.addEventListener('input', (e) => {
      const t = e.target;
      if (t.id === 'partSearch') { S.q = t.value; return renderGallery(); }
      if (t.id === 'libSearch') { ui.libQuery = t.value; renderCode(); const s = $('#libSearch'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); return; }
      if (t.id === 'projTitle') { S.title = t.value; return refreshLight(); }
      if (t.id === 'codeArea') { S.code = t.value; if (!S.codeEdited) { S.codeEdited = true; renderCode(); const ta = $('#codeArea'); ta.focus(); ta.setSelectionRange(t.selectionStart, t.selectionStart); } return save(); }
      if (t.dataset.bind && t.type !== 'checkbox' && t.tagName !== 'SELECT') {
        let v = t.value;
        if (t.dataset.num) v = v === '' ? null : +v;
        setPath(P(), t.dataset.bind, v);
        S.starter = null;
        return refreshLight();
      }
    });

    document.addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'boardSel') {
        const prev = board();
        S.board = t.value; S.lang = null;
        const nb = board();
        const dropped = S.build.filter((b) => !FM.parts[b.id].families.includes(nb.family)).map((b) => FM.parts[b.id].name);
        render();
        return toast('Switched to ' + nb.short + '. Pins were planned again.' + (dropped.length ? ' Not available here: ' + Array.from(new Set(dropped)).join(', ') + '.' : '') + (prev.family !== nb.family ? ' The code is now ' + FM.LANG_NAME[lang()] + '.' : ''));
      }
      if (t.id === 'langSel') { S.lang = t.value; S.codeEdited = false; return render(); }
      if (t.id === 'portSel') { ui.port = t.value; return; }
      if (t.dataset.rename != null) { renameRead(+t.dataset.rename, t.value); return render(); }
      if (t.dataset.via) { P().listen.via = t.dataset.via; return render(); }
      if (t.dataset.reply) { const L = P().listen; const v = t.dataset.reply; L.replies = t.checked ? L.replies.concat([v]) : L.replies.filter((x) => x !== v); return render(); }
      if (t.dataset.src != null) { const r = P().listen.rules[+t.dataset.src]; const [uid, k] = t.value.split('|'); r.uid = uid; r.k = k; return refreshLight(); }
      if (t.dataset.bind) {
        let v = t.value;
        if (t.dataset.num) v = v === '' ? null : +v;
        setPath(P(), t.dataset.bind, v);
        if (t.dataset.bind.endsWith('.target')) { const s = getPath(P(), t.dataset.bind.replace(/\.target$/, '')); s.target = FM.safeName(v); }
        const r = t.dataset.bind.match(/^listen\.rules\.(\d+)\.do$/);
        if (r) { const rule = P().listen.rules[+r[1]]; const first = A.inst.find((i) => i.supported && (rule.do === 'photo' ? i.def.id === 'camera' : ['led', 'relay', 'buzzer'].includes(i.def.id))); if (['on', 'off', 'photo'].includes(rule.do)) rule.uid = first && first.uid; if (rule.do === 'reading' && !rule.uid) { const i = A.inst.find((x) => x.supported && x.def.values.some((v2) => !v2.text)); if (i) { rule.uid = i.uid; rule.k = i.def.values[0].k; } else { rule.uid = 'sys'; rule.k = FM.sysValues(board())[0].k; } rule.text = rule.text || '{value}'; } }
        if (t.tagName === 'SELECT' || t.dataset.changeRender) return render();
        return refreshLight();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.target.id === 'sendText' && e.key === 'Enter') { e.preventDefault(); sendLine(); }
      if (e.target.id === 'codeArea' && e.key === 'Tab') {
        e.preventDefault();
        const ta = e.target, s = ta.selectionStart;
        const ind = G.lang === 'arduino' ? '  ' : '    ';
        ta.setRangeText(ind, s, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (e.key === 'Escape' && ui.picker) { ui.picker = null; renderFlow(); }
    });

    $('#modeLoop').onclick = () => { P().mode = 'loop'; render(); };
    $('#modeListen').onclick = () => { P().mode = 'listen'; render(); };
    $('#helperPill').onclick = async () => { await FM.helper.check(); render(); toast(FM.helper.online ? 'Helper connected.' : 'Helper not found. Run python3 helper/fm_helper.py and open http://localhost:8765.'); };
    $('#serialPill').onclick = () => { S.tab = 'serial'; if (!FM.serial.connected && FM.serial.supported) connectSerial(); else { renderCode(); $('#code').scrollIntoView({ behavior: 'smooth' }); } };
    window.addEventListener('resize', () => requestAnimationFrame(drawWires));
    FM.serial.onData((text) => appendMonitor(text));
    FM.serial.onStatus(() => { renderTop(); if (S.tab === 'serial' || S.tab === 'upload') renderCode(); });
  }

  function appendMonitor(text) {
    ui.monitor = (ui.monitor + text.replace(/\x04|\x01|\x02|\x03/g, '')).slice(-60000);
    const mon = $('#monitor');
    if (mon) { mon.textContent = ui.monitor; mon.scrollTop = mon.scrollHeight; }
  }

  async function connectSerial() {
    try {
      const info = await FM.serial.connect(115200);
      const guess = FM.serial.guessBoards(info);
      S.tab = 'serial';
      render();
      $('#code').scrollIntoView({ behavior: 'smooth' });
      toast(guess.length ? 'Connected. Looks like ' + guess[0].note + '.' : 'Connected.');
    } catch (err) { if (err.name !== 'NotFoundError') toast(err.message); }
  }
  async function sendLine() {
    const input = $('#sendText');
    if (!input || !input.value) return;
    try { await FM.serial.write(input.value + '\r\n'); input.value = ''; } catch (err) { toast(err.message); }
  }
  async function mpUpload() {
    try {
      if (!FM.serial.connected) await FM.serial.connect(115200);
      ui.busy = 'Saving main.py…';
      renderCode();
      await FM.serial.uploadMicroPython(S.code, 'main.py', (p) => { ui.busy = 'Saving main.py… ' + Math.round(p * 100) + '%'; const n = $('#code .note.tip:last-of-type'); if (n) n.textContent = ui.busy; });
      ui.busy = '';
      S.tab = 'serial';
      render();
      toast('Saved. The board restarted with your program.');
    } catch (err) { ui.busy = ''; renderCode(); if (err.name !== 'NotFoundError') toast('Upload failed: ' + err.message); }
  }
  const selectedPort = () => ui.port || (ui.ports && ui.ports[0] && ui.ports[0].device) || '';
  async function refreshPorts() {
    try { const r = await FM.helper.ports(); ui.ports = r.ports || []; if (!ui.port && ui.ports[0]) ui.port = ui.ports[0].device; } catch (err) { toast(err.message); }
    renderCode();
  }
  async function helperTask(label, fn, follow) {
    if (FM.serial.connected) await FM.serial.disconnect(); // the port can only be open in one place
    ui.busy = label; ui.uploadLog = '';
    renderCode();
    try {
      const r = await fn();
      ui.busy = r.ok === false ? 'It did not work. See the log below.' : 'Done.';
      ui.uploadLog = r.output || '';
      if (follow) followLog();
    } catch (err) { ui.busy = 'Failed: ' + err.message; }
    renderCode();
  }
  let logSince = 0, logTimer = null;
  function followLog() {
    clearInterval(logTimer);
    logTimer = setInterval(async () => {
      try { const r = await FM.helper.log(logSince); if (r.text) appendMonitor(r.text); logSince = r.next; if (!r.running) clearInterval(logTimer); }
      catch (e) { clearInterval(logTimer); }
    }, 1000);
  }

  // ---------------- start ----------------
  function start() {
    S = load();
    if (!S || !S.program || !FM.boards[S.board]) S = fresh();
    S.program = Object.assign(FM.newProgram(), S.program);
    bindEvents();
    FM.sim.mount($('#sim'), () => ({ A, prog: P(), board: board(), lang: lang() }));
    render();
    if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
    FM.helper.check().then(() => { renderTop(); if (S.tab !== 'code') renderCode(); });
  }
  FM.app = { get state() { return S; }, render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
