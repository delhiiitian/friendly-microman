/* Program helpers shared by the UI and the tests: templates, cleaning up
   references to removed parts, and picking the right code generator. */
(function () {
  FM.newProgram = () => ({ mode: 'loop', interval: 5, reads: [], steps: [], actions: [], listen: { via: 'typed', rules: [], replies: ['print'] }, net: FM.netDefaults() });

  FM.loadTemplate = function (t, board) {
    const build = t.parts.map((id) => ({ uid: FM.uid(), id }));
    const raw = typeof t.program === 'function' ? t.program(board) : t.program;
    const json = JSON.stringify(raw).replace(/"@(\d+)"/g, (m, n) => JSON.stringify(build[+n] ? build[+n].uid : 'missing'));
    const program = Object.assign(FM.newProgram(), JSON.parse(json));
    program.actions.forEach((a) => { a.id = a.id || FM.uid(); });
    if (program.listen) program.listen.rules.forEach((r) => { r.id = r.id || FM.uid(); });
    return { build, program, title: t.title };
  };

  // Remove anything that points at a part that is no longer in the build.
  FM.prune = function (program, A) {
    const ok = (uid) => uid === 'sys' || uid === 'print' || uid === 'log' || FM.NET_OUTPUTS.includes(uid) || (A.byUid[uid] && A.byUid[uid].supported);
    program.reads = program.reads.filter((r) => ok(r.uid) && FM.valueMeta(A, r));
    program.actions = program.actions.filter((a) => ok(a.uid));
    const names = FM.programNames(A, program).map((n) => n.name);
    program.steps = program.steps.filter((s) => (s.t === 'math' ? names.includes(s.a) : names.includes(s.key)));
    program.actions.forEach((a) => { if (a.key && !names.includes(a.key)) a.key = names[0]; });
    // "show a number" and "follow a reading" need a value to work with
    program.actions = program.actions.filter((a) => !(['follow', 'number'].includes(a.act) && !a.key));
    if (program.listen) program.listen.replies = (program.listen.replies || []).filter(ok);
    return program;
  };

  FM.uniqueName = function (program, base) {
    const taken = new Set(program.reads.map((r) => r.name).concat(program.steps.filter((s) => s.t === 'math').map((s) => s.target)));
    let name = FM.safeName(base);
    if (!taken.has(name)) return name;
    let n = 2;
    while (taken.has(name + '_' + n)) n++;
    return name + '_' + n;
  };

  const langs0 = (board, lang) => (FM.langsFor(board).includes(lang) ? lang : FM.langsFor(board)[0]);

  FM.generate = function (board, build, program, meta, lang) {
    const A = FM.allocate(board, build);
    FM.prune(program, A);
    // network outputs only stay where the board can reach the network
    if (!FM.hasNetwork(board, langs0(board, lang))) program.actions = program.actions.filter((a) => a.uid !== 'mqtt' && a.uid !== 'telegram');
    const langs = FM.langsFor(board);
    const L = langs.includes(lang) ? lang : langs[0];
    const out = FM.gen[L](A, program, meta || {});
    out.lang = L;
    out.A = A;
    out.file = L === 'arduino' ? FM.safeName(meta && meta.title || 'sketch') + '.ino' : FM.FAMILY[board.family].file;
    return out;
  };

  // Which actions a board/language can run at all (speech needs a Pi, files need a filesystem).
  FM.builtinOutputs = function (board, lang) {
    const out = [{ uid: 'print', act: 'print', name: lang === 'python' ? 'Print in the terminal' : 'Print to the serial monitor', msg: true }];
    if (lang !== 'arduino') out.push({ uid: 'log', act: 'log', name: lang === 'python' ? 'Save to readings.csv' : 'Save to log.csv on the board' });
    out.push({ uid: 'plot', act: 'plot', name: 'Draw a live graph' });
    if (FM.hasNetwork(board, lang)) {
      out.push({ uid: 'mqtt', act: 'mqtt', name: 'Send to MQTT' + (board.family === 'pico' ? ' (Pico W)' : '') });
      out.push({ uid: 'telegram', act: 'telegram', name: 'Send a Telegram message' + (board.family === 'pico' ? ' (Pico W)' : ''), msg: true });
    }
    return out;
  };
})();

/* Runs the Change steps on a set of values, the same way the generated code does.
   Used by the live message preview and the simulator. history keeps smoothing state. */
(function () {
  FM.applySteps = function (values, steps, history) {
    const v = Object.assign({}, values);
    (steps || []).forEach((s) => {
      if (s.t === 'convert') { if (typeof v[s.key] === 'number') v[s.key] = Math.round((v[s.key] * 9 / 5 + 32) * 10) / 10; return; }
      if (s.t === 'smooth') {
        if (typeof v[s.key] !== 'number' || !history) return;
        const h = (history[s.key] = history[s.key] || []);
        h.push(v[s.key]);
        while (h.length > (s.n || 5)) h.shift();
        v[s.key] = Math.round(h.reduce((a, b) => a + b, 0) / h.length * 10) / 10;
        return;
      }
      if (s.t !== 'math') return;
      const x = v[s.a];
      if (typeof x !== 'number') { v[s.target] = null; return; }
      const b = +s.b || 0;
      let y = x;
      if (s.op === '+') y = x + b; else if (s.op === '-') y = x - b; else if (s.op === '*') y = x * b; else if (s.op === '/') y = x / (b || 1);
      else if (s.op === 'abs') y = Math.abs(x); else if (s.op === 'round') y = Math.round(x * Math.pow(10, b)) / Math.pow(10, b);
      else if (s.op === 'map') { const b2 = s.b2 == null ? 100 : +s.b2, c1 = +s.c1 || 0, c2 = s.c2 == null ? 100 : +s.c2; y = (x - b) / ((b2 - b) || 1) * (c2 - c1) + c1; }
      v[s.target] = y;
    });
    return v;
  };

  FM.checkLimit = function (v, steps) {
    const l = (steps || []).find((s) => s.t === 'limit');
    if (!l) return true;
    const x = v[l.key];
    if (l.op === 'yes') return x == 1;
    if (l.op === 'no') return x == 0;
    if (typeof x !== 'number') return false;
    const n = +l.val || 0;
    return { '>': x > n, '<': x < n, '>=': x >= n, '<=': x <= n, '==': x === n }[l.op || '>'];
  };

  FM.fillTemplate = function (tpl, v, bools) {
    return FM.parseTemplate(tpl).map((p) => {
      if (p.text != null) return p.text;
      const x = v[p.name];
      if (x == null) return '?';
      if (bools && bools.includes(p.name)) return x ? 'yes' : 'no';
      if (typeof x === 'number') return String(Math.abs(x) < 1000 ? Math.round(x * 10) / 10 : Math.round(x));
      return String(x);
    }).join('');
  };
})();
