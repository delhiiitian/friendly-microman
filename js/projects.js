/* Saving and sharing projects. A project is the board, the parts and the program.
   Share codes are compressed JSON in base64url, so they fit in a link (#share=...).
   Anything that arrives from a link or a file is rebuilt field by field, so a crafted
   project cannot slip code into the generated program through a number or a name. */
(function () {
  const LIST = 'fm-projects-v1';
  const NUM = ['interval', 'b', 'b2', 'c1', 'c2', 'val', 'n', 'every', 'angle', 'angle2', 'min', 'max', 'steps', 'port'];
  const IDENT = ['name', 'target', 'key', 'a', 'bRef'];
  const TEXT = ['msg', 'text', 'say', 'topic', 'message'];
  const ENUM = {
    t: ['math', 'smooth', 'convert', 'limit'],
    op: ['+', '-', '*', '/', 'abs', 'round', 'map', '>', '<', '>=', '<=', '==', 'yes', 'no'],
    when: ['always', 'alert', 'calm'],
    do: ['time', 'text', 'stop', 'reading', 'on', 'off', 'photo'],
  };
  const TOKEN = /^[\w-]{1,40}$/;

  function clean(o) {
    const out = {};
    if (!o || typeof o !== 'object') return out;
    Object.keys(o).forEach((k) => {
      const x = o[k];
      if (NUM.includes(k)) { const n = Number(x); out[k] = x == null || x === '' || !isFinite(n) ? null : n; }
      else if (IDENT.includes(k)) { if (x != null) out[k] = FM.safeName(String(x)); }
      else if (TEXT.includes(k)) { if (x != null) out[k] = String(x).slice(0, 500); }
      else if (ENUM[k]) { if (ENUM[k].includes(x)) out[k] = x; }
      else if (k === 'colour' || k === 'colour2') { if (/^#[0-9a-f]{6}$/i.test(x)) out[k] = x; }
      else if (['id', 'uid', 'k', 'act'].includes(k)) { if (TOKEN.test(String(x))) out[k] = String(x); }
    });
    return out;
  }
  const keep = (list, need) => (Array.isArray(list) ? list : []).slice(0, 60).map(clean).filter((x) => need.every((k) => x[k] != null));

  // Rebuild a project from untrusted data. Returns null if it is not a project.
  function sanitize(p) {
    if (!p || typeof p !== 'object' || !FM.boards[p.board]) return null;
    const build = (Array.isArray(p.build) ? p.build : []).slice(0, 40)
      .filter((b) => b && TOKEN.test(String(b.uid)) && FM.parts[b.id]).map((b) => {
        const e = { uid: String(b.uid), id: b.id };
        const pins = {};
        if (b.pins && typeof b.pins === 'object') Object.keys(b.pins).forEach((k) => { if (/^\d{1,2}$/.test(k) && TOKEN.test(String(b.pins[k])) && FM.boards[p.board].pins[b.pins[k]]) pins[k] = String(b.pins[k]); });
        if (Object.keys(pins).length) e.pins = pins;
        return e;
      });
    const g = p.program || {};
    const prog = FM.newProgram();
    prog.mode = g.mode === 'listen' ? 'listen' : 'loop';
    const iv = Number(g.interval);
    prog.interval = isFinite(iv) && iv > 0 ? Math.min(iv, 86400) : 5;
    prog.reads = keep(g.reads, ['uid', 'k', 'name']);
    prog.steps = keep(g.steps, ['t']);
    prog.actions = keep(g.actions, ['uid', 'act']).map((a) => Object.assign({ id: FM.uid(), when: 'always', every: 0, msg: '' }, a));
    if (g.message != null) prog.message = String(g.message).slice(0, 500);
    const L = g.listen || {};
    prog.listen = {
      via: L.via === 'voice' ? 'voice' : 'typed',
      rules: keep(L.rules, ['do']).map((r) => Object.assign({ id: FM.uid() }, r)),
      replies: (Array.isArray(L.replies) ? L.replies : ['print']).filter((r) => TOKEN.test(String(r))).slice(0, 10),
    };
    const n = g.net || {};
    prog.net = FM.netDefaults();
    ['ssid', 'pass', 'broker', 'token', 'chat'].forEach((k) => { if (n[k] != null) prog.net[k] = String(n[k]).slice(0, 200); });
    if (isFinite(Number(n.port)) && n.port) prog.net.port = Math.max(1, Math.min(65535, Math.round(Number(n.port))));
    const out = { v: 1, title: String(p.title || 'Shared project').slice(0, 80), board: p.board, lang: FM.LANG_NAME[p.lang] ? p.lang : null, build, program: prog };
    if (typeof p.code === 'string' && p.code.length < 200000) out.code = p.code;
    return out;
  }

  // What gets saved or shared. Secrets (Wi-Fi password, bot token) stay out of share codes and files.
  function pack(S, opts) {
    const program = JSON.parse(JSON.stringify(S.program));
    if (opts && opts.share) { program.net = Object.assign({}, program.net, { pass: '', token: '' }); }
    const p = { v: 1, title: S.title || 'My project', board: S.board, lang: S.lang, build: S.build, program };
    if (S.codeEdited && S.code) p.code = S.code;
    return p;
  }

  // ---------- share codes ----------
  const b64url = (bytes) => { let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64url = (s) => { const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };
  async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
  const canZip = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

  async function encode(p) {
    const bytes = new TextEncoder().encode(JSON.stringify(p));
    if (canZip()) return 'fm1.' + b64url(await pipe(bytes, new CompressionStream('deflate-raw')));
    return 'fm0.' + b64url(bytes);
  }
  async function decode(input) {
    let s = String(input || '').trim();
    const m = s.match(/[#&?]share=([\w.-]+)/);
    if (m) s = m[1];
    let json;
    if (s.startsWith('{')) json = s; // a project file pasted as text
    else if (s.startsWith('fm1.')) { if (!canZip()) throw new Error('This browser cannot open compressed share codes.'); json = new TextDecoder().decode(await pipe(unb64url(s.slice(4)), new DecompressionStream('deflate-raw'))); }
    else if (s.startsWith('fm0.')) json = new TextDecoder().decode(unb64url(s.slice(4)));
    else throw new Error('That is not a friendly-microman link or share code.');
    let data;
    try { data = JSON.parse(json); } catch (e) { throw new Error('The share code is damaged. Copy it again.'); }
    const p = sanitize(data.project || data);
    if (!p) throw new Error('That is not a friendly-microman project.');
    return p;
  }

  // ---------- saved on this computer ----------
  function list() { try { const l = JSON.parse(localStorage.getItem(LIST)); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function write(l) { try { localStorage.setItem(LIST, JSON.stringify(l)); return true; } catch (e) { return false; } }
  function saveAs(p) {
    const l = list();
    const same = l.find((x) => x.title === p.title && x.board === p.board);
    const entry = { id: same ? same.id : FM.uid(), title: p.title, board: p.board, parts: p.build.map((b) => b.id), saved: Date.now(), project: p };
    return write([entry].concat(l.filter((x) => x.id !== entry.id)).slice(0, 50)) ? entry : null;
  }
  function remove(id) { return write(list().filter((x) => x.id !== id)); }
  const fileText = (p) => JSON.stringify({ friendlyMicroman: 1, project: p }, null, 2);

  FM.projects = { pack, sanitize, encode, decode, list, saveAs, remove, fileText };
})();
