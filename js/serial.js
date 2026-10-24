/* USB serial in the browser (Web Serial, Chrome and Edge). Connects to a board,
   guesses which board it is from the USB chip, shows its output, and can save
   main.py onto a MicroPython board through the raw REPL. */
(function () {
  const S = (FM.serial = {
    supported: typeof navigator !== 'undefined' && 'serial' in navigator,
    port: null, writer: null, reader: null, connected: false, info: null,
    buffer: '', listeners: new Set(), statusListeners: new Set(),
  });
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  S.onData = (fn) => S.listeners.add(fn);
  S.onStatus = (fn) => S.statusListeners.add(fn);
  const status = () => S.statusListeners.forEach((fn) => fn(S));

  // Which board profiles match the USB vendor id we see.
  S.guessBoards = function (info) {
    if (!info || info.usbVendorId == null) return [];
    return FM.boardOrder.map((id) => FM.boards[id]).filter((b) => (b.usbIds || []).some((u) => u.vid === info.usbVendorId))
      .map((b) => ({ board: b, note: b.usbIds.find((u) => u.vid === info.usbVendorId).note }));
  };

  S.connect = async function (baudRate) {
    if (!S.supported) throw new Error('This browser cannot talk to USB boards. Use Chrome or Edge on a computer.');
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: baudRate || 115200 });
    S.port = port;
    S.info = port.getInfo();
    S.writer = port.writable.getWriter();
    S.connected = true;
    status();
    readLoop();
    return S.info;
  };

  async function readLoop() {
    while (S.port && S.port.readable) {
      S.reader = S.port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await S.reader.read();
          if (done) break;
          const text = dec.decode(value, { stream: true });
          S.buffer += text;
          if (S.buffer.length > 200000) S.buffer = S.buffer.slice(-100000);
          S.listeners.forEach((fn) => fn(text));
        }
      } catch (e) {
        S.listeners.forEach((fn) => fn('\n[serial] ' + e.message + '\n'));
      } finally {
        try { S.reader.releaseLock(); } catch (e) { /* already released */ }
      }
      if (!S.connected) break;
    }
  }

  S.disconnect = async function () {
    S.connected = false;
    try { if (S.reader) await S.reader.cancel(); } catch (e) { /* ignore */ }
    try { if (S.writer) S.writer.releaseLock(); } catch (e) { /* ignore */ }
    try { if (S.port) await S.port.close(); } catch (e) { /* ignore */ }
    S.port = S.writer = S.reader = null;
    status();
  };

  S.write = async function (data) {
    if (!S.writer) throw new Error('No board connected.');
    await S.writer.write(typeof data === 'string' ? enc.encode(data) : data);
  };

  async function waitFor(text, ms, from) {
    const start = Date.now();
    const base = from == null ? S.buffer.length : from;
    while (Date.now() - start < ms) {
      const i = S.buffer.indexOf(text, base);
      if (i >= 0) return S.buffer.slice(base, i + text.length);
      await sleep(20);
    }
    throw new Error('The board did not answer (waited for "' + text.replace(/[\x00-\x1f]/g, '') + '"). Is MicroPython installed?');
  }

  // Run one statement in the raw REPL and return what it printed.
  async function rawExec(code) {
    const mark = S.buffer.length;
    await S.write(code);
    await S.write('\x04');
    const out = await waitFor('\x04>', 8000, mark);
    const err = out.split('\x04')[1] || '';
    if (err.trim()) throw new Error(err.trim());
    return out;
  }

  function pyBytes(bytes) {
    let s = "b'";
    for (const b of bytes) {
      if (b === 0x5c) s += '\\\\';
      else if (b === 0x27) s += "\\'";
      else if (b >= 0x20 && b < 0x7f) s += String.fromCharCode(b);
      else s += '\\x' + b.toString(16).padStart(2, '0');
    }
    return s + "'";
  }

  // Save code to the board's flash and restart it. progress(0..1) is called as it goes.
  S.uploadMicroPython = async function (code, filename, progress) {
    filename = filename || 'main.py';
    const mark = S.buffer.length;
    await S.write('\r\x03\x03'); // stop whatever is running
    await sleep(150);
    await S.write('\r\x01'); // enter raw REPL
    await waitFor('raw REPL; CTRL-B to exit\r\n>', 3000, mark);
    await rawExec("f=open('" + filename + "','wb')");
    const bytes = enc.encode(code);
    const CHUNK = 192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      await rawExec('f.write(' + pyBytes(bytes.slice(i, i + CHUNK)) + ')');
      if (progress) progress(Math.min(1, (i + CHUNK) / bytes.length));
    }
    await rawExec('f.close()');
    await S.write('\x02'); // back to the normal REPL
    await sleep(100);
    await S.write('\x04'); // soft reset: main.py starts
  };

  S.stopProgram = async function () { await S.write('\r\x03\x03'); };

  if (S.supported) {
    navigator.serial.addEventListener('disconnect', (e) => { if (e.target === S.port) { S.connected = false; S.port = S.writer = S.reader = null; status(); } });
  }
})();
