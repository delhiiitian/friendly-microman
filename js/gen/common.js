/* Shared pieces for the code generators: the program model, value naming,
   message templates and a tiny code writer.

   Program model (what the block builder edits):
   {
     mode: 'loop' | 'listen',
     interval: seconds between readings,
     reads:   [{ uid, k, name }]            channels to read; name is used in messages as {name}
     steps:   [{ t:'math', target, a, op, b, b2, c1, c2 } | { t:'smooth', key, n } | { t:'convert', key }
               | { t:'limit', key, op, val }]   at most one limit; it defines `alert`
     actions: [{ id, uid, act, when, every, msg, angle, angle2, key, min, max, colour, colour2, n, steps }]
     listen:  { via:'voice'|'typed', rules:[{ say, do, uid, k, text }], replies:[uid|'print'] }
   } */
(function () {
  FM.gen = FM.gen || {};

  // Built-in "board" source: values every board can produce without extra parts.
  FM.sysValues = function (board) {
    const out = [{ k: 'uptime', l: 'Seconds since start', u: 's' }];
    if (board.family === 'pi') out.unshift({ k: 'cpu_temp', l: 'CPU temperature', u: '°C' }, { k: 'clock', l: 'Clock time', u: 'hh:mm', text: true });
    if (board.internalTemp) out.unshift({ k: 'chip_temp', l: 'Chip temperature', u: '°C' });
    return out;
  };

  FM.valueMeta = function (A, read) {
    if (read.uid === 'sys') return FM.sysValues(A.board).find((x) => x.k === read.k);
    const inst = A.byUid[read.uid];
    return inst && inst.def.values.find((x) => x.k === read.k);
  };

  // All names usable in messages and steps: read channels plus math results.
  FM.programNames = function (A, prog) {
    const names = [];
    (prog.reads || []).forEach((r) => {
      const m = FM.valueMeta(A, r);
      if (m) names.push({ name: r.name, unit: m.u, bool: !!m.bool, text: !!m.text, label: m.l, from: r });
    });
    (prog.steps || []).forEach((s) => {
      if (s.t === 'math' && s.target && !names.some((n) => n.name === s.target)) {
        const src = names.find((n) => n.name === s.a);
        names.push({ name: s.target, unit: s.op === 'map' ? '' : src ? src.unit : '', label: 'Calculated', calc: true });
      }
    });
    return names;
  };

  FM.safeName = function (s) {
    let n = String(s || '').replace(/[\u2080-\u2089]/g, (c) => String(c.charCodeAt(0) - 0x2080)).normalize('NFKD').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
    if (!n) n = 'value';
    if (/^[0-9]/.test(n)) n = 'v_' + n;
    return n;
  };

  // Split "x axis is {x} m/s" into [{text:'x axis is '}, {name:'x'}, {text:' m/s'}]
  FM.parseTemplate = function (t) {
    const out = [];
    const re = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    let last = 0, m;
    while ((m = re.exec(t))) {
      if (m.index > last) out.push({ text: t.slice(last, m.index) });
      out.push({ name: m[1] });
      last = re.lastIndex;
    }
    if (last < t.length) out.push({ text: t.slice(last) });
    return out;
  };

  FM.defaultMessage = function (A, prog) {
    const names = FM.programNames(A, prog);
    if (!names.length) return 'Hello from your board!';
    return names.slice(0, 4).map((n) => n.label.replace(/ \(.*\)$/, '') + ': {' + n.name + '}' + (n.unit && !n.bool && !n.text ? ' ' + n.unit : '')).join(', ');
  };

  // Which part instance an action or rule points at.
  FM.actionTarget = function (A, a) { return a.uid === 'print' || a.uid === 'log' || FM.NET_OUTPUTS.includes(a.uid) ? null : A.byUid[a.uid]; };

  // Code writer with indentation.
  FM.Writer = function () {
    const lines = [];
    let ind = 0;
    const w = {
      line(s) { (s == null ? [''] : String(s).split('\n')).forEach((l) => lines.push(l ? '    '.repeat(ind) + l : '')); return w; },
      blank() { if (lines.length && lines[lines.length - 1] !== '') lines.push(''); return w; },
      in() { ind++; return w; }, out() { ind = Math.max(0, ind - 1); return w; },
      text() { return lines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n'; },
    };
    return w;
  };

  FM.indent = (s, n) => String(s).split('\n').map((l) => (l ? '    '.repeat(n) + l : l)).join('\n');
  FM.pyStr = (s) => JSON.stringify(String(s));
  FM.hexColour = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); const n = m ? parseInt(m[1], 16) : 0xffffff; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

  // Common description of when an action runs, for comments.
  FM.whenText = (a) => (a.when === 'alert' ? 'only when the check is true' : a.when === 'calm' ? 'only when the check is false' : 'every reading');

  // Collect library ids a program needs for the given language.
  FM.collectLibs = function (A, lang, extra) {
    const ids = new Set(extra || []);
    A.inst.forEach((i) => { if (i.supported) ((i.def.libs || {})[lang] || []).forEach((l) => ids.add(l)); });
    return Array.from(ids).filter((id) => FM.libraries[id]);
  };
})();
