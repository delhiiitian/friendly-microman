/* friendly-microman core: shared namespace, registries and small helpers.
   Boards and parts are plain data registered here, so adding a board or a
   part never requires touching the UI code. */
(function () {
  const FM = (window.FM = window.FM || {});

  FM.boards = {};
  FM.boardOrder = [];
  FM.parts = {};
  FM.partOrder = [];
  FM.templates = [];
  FM.libraries = {};

  // Pin "types" drive colours and the explanation shown when a pin is tapped.
  FM.PIN_TYPES = {
    v5: { name: '5 V power', short: '5V', info: 'Power straight from the USB supply. Use it for 5 V modules such as servos, relays and LCDs. Never connect 5 V to a signal pin of a 3.3 V board.' },
    v3: { name: '3.3 V power', short: '3V3', info: 'Regulated 3.3 V. Good for sensors and small modules. Motors, LED strips and other hungry parts need their own supply.' },
    vin: { name: 'Power input', short: 'VIN', info: 'Feeds the board. You can power the board here (check the allowed voltage) or take power out when it runs from USB.' },
    gnd: { name: 'Ground', short: 'GND', info: 'Ground (0 V). Every part needs a ground wire, and all GND pins are joined together, so any of them works.' },
    gpio: { name: 'General purpose pin', short: 'GPIO', info: 'A pin your program can switch on and off, or read as on/off. Handy for LEDs, buttons, buzzers and simple sensors.' },
    i2c: { name: 'I2C bus', short: 'I2C', info: 'A two-wire bus (SDA data, SCL clock). Many sensors and displays share the same two pins; each has its own address.' },
    spi: { name: 'SPI bus', short: 'SPI', info: 'A fast bus for displays, SD cards and RFID readers. Devices share MOSI, MISO and SCK, and each gets its own chip-select pin.' },
    uart: { name: 'Serial (UART)', short: 'UART', info: 'Two-wire serial: TX sends, RX receives. Cross them over: the part’s TX goes to the board’s RX.' },
    pwm: { name: 'PWM-capable pin', short: 'PWM', info: 'Can make fast on/off pulses, used to dim LEDs, set servo angles and play tones.' },
    adc: { name: 'Analog input', short: 'ADC', info: 'Reads a voltage as a number, so it can measure potentiometers, light sensors and soil probes.' },
    sys: { name: 'System pin', short: 'SYS', info: 'Used by the board itself (reset, boot, flash memory or HAT identification). Leave it free.' },
  };

  FM.registerBoard = function (b) {
    // Normalise pins so every pin has id, label and type.
    Object.entries(b.pins).forEach(([id, p]) => { p.id = id; p.type = p.type || 'gpio'; p.label = p.label || id; });
    b.power = b.power || {};
    b.bus = b.bus || {};
    b.pwm = b.pwm || [];
    b.adc = b.adc || [];
    b.avoid = b.avoid || {};
    b.ports = b.ports || [];
    FM.boards[b.id] = b;
    FM.boardOrder.push(b.id);
  };

  FM.registerPart = function (p) {
    p.sig = p.sig || [];
    p.notes = p.notes || [];
    p.values = p.values || [];
    p.families = p.families || ['pi', 'pico', 'esp32', 'esp8266', 'arduino'];
    FM.parts[p.id] = p;
    FM.partOrder.push(p.id);
  };

  FM.registerTemplate = function (t) { FM.templates.push(t); };
  FM.registerLibrary = function (l) { FM.libraries[l.id] = l; };

  FM.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  FM.uid = () => 'u' + Math.random().toString(36).slice(2, 9);
  FM.hex = (n) => '0x' + n.toString(16).toUpperCase().padStart(2, '0');

  // Human description of a pin for wiring steps, e.g. "Pin 3 · GPIO2 (SDA)".
  FM.pinRef = function (board, id) {
    const p = board.pins[id];
    if (!p) return id;
    const power = ['v3', 'v5', 'vin', 'gnd'].includes(p.type);
    const fn = p.fn && !power && p.type !== 'gpio' ? p.fn.split(' \u00b7 ')[0] : '';
    if (board.refStyle === 'number') return 'Pin ' + id + ' \u00b7 ' + p.label + (fn ? ' (' + fn + ')' : '');
    const gp = board.family !== 'arduino' && p.gpio != null && !String(p.label).includes(String(p.gpio)) ? ' (GPIO' + p.gpio + ')' : '';
    return p.label + gp + (fn ? ' \u00b7 ' + fn : '');
  };

  // Board families decide the language the code generator writes.
  FM.FAMILY = {
    pi: { name: 'Raspberry Pi', lang: 'python', langName: 'Python 3', ext: 'py', file: 'program.py' },
    pico: { name: 'Raspberry Pi Pico', lang: 'micropython', langName: 'MicroPython', ext: 'py', file: 'main.py' },
    esp32: { name: 'ESP32', lang: 'micropython', langName: 'MicroPython', ext: 'py', file: 'main.py', alt: 'arduino' },
    esp8266: { name: 'ESP8266', lang: 'micropython', langName: 'MicroPython', ext: 'py', file: 'main.py', alt: 'arduino' },
    arduino: { name: 'Arduino', lang: 'arduino', langName: 'Arduino C++', ext: 'ino', file: 'sketch.ino' },
  };
  FM.LANG_NAME = { python: 'Python 3', micropython: 'MicroPython', arduino: 'Arduino C++' };
  FM.langsFor = function (board) {
    const f = FM.FAMILY[board.family];
    const out = [f.lang];
    if (f.alt) out.push(f.alt);
    if (board.family === 'pico') out.push('arduino');
    return out;
  };
})();
