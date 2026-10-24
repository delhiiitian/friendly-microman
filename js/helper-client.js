/* Client for the optional local helper (helper/fm_helper.py). The helper runs on
   your computer or Pi, serves this app at http://localhost:8765, and does what a
   web page cannot: compile Arduino sketches, upload with arduino-cli or mpremote,
   install libraries, and run Python programs on a Pi. */
(function () {
  const H = (FM.helper = { online: false, info: null, base: '', token: null, listeners: new Set() });
  // When the helper serves this page, talk to it on the same address (this also works for a Pi
  // opened from another computer). Otherwise look for it on this computer.
  const served = typeof location !== 'undefined' && /^https?:$/.test(location.protocol) && location.hostname !== '';
  const candidates = served ? ['', 'http://localhost:8765'] : ['http://localhost:8765'];
  H.base = candidates[0];
  H.onChange = (fn) => H.listeners.add(fn);
  const changed = () => H.listeners.forEach((fn) => fn(H));

  async function call(path, body, timeout) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout || 4000);
    try {
      const res = await fetch(H.base + path, {
        method: body ? 'POST' : 'GET',
        headers: Object.assign({ 'Content-Type': 'application/json' }, H.token ? { 'X-FM-Token': H.token } : {}),
        body: body ? JSON.stringify(body) : undefined,
        signal: ctl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Helper said ' + res.status);
      return data;
    } finally { clearTimeout(t); }
  }

  H.check = async function () {
    H.online = false; H.info = null;
    for (const base of candidates) {
      H.base = base;
      try {
        const info = await call('/api/status', null, 1500);
        if (!info || !info.version) continue;
        H.info = info;
        if (!H.token) { const t = await call('/api/token', null, 1500); H.token = t.token; }
        H.online = true;
        break;
      } catch (e) { /* try the next address */ }
    }
    changed();
    return H.online;
  };

  H.ports = () => call('/api/ports');
  H.installLib = (lib, port) => call('/api/libs/install', { kind: lib.kind, pkg: lib.pkg, port }, 300000);
  H.installedLibs = (kind) => call('/api/libs/list?kind=' + encodeURIComponent(kind), null, 20000);
  H.uploadArduino = (code, fqbn, port, name) => call('/api/arduino/upload', { code, fqbn, port, name }, 600000);
  H.uploadMicroPython = (code, port) => call('/api/micropython/upload', { code, port }, 120000);
  H.runPython = (code) => call('/api/python/run', { code }, 20000);
  H.stopPython = () => call('/api/python/stop', {}, 8000);
  H.log = (since) => call('/api/log?since=' + (since || 0), null, 4000);
})();
