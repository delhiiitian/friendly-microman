/* MicroPython generator for Pico, ESP32 and ESP8266 (machine module + small inline drivers). */
(function () {
  const g = (i, idx) => { const id = i.pins[idx]; return id ? i.board.pins[id].gpio : '?'; };
  const gs = (i, name) => g(i, i.def.sig.findIndex((s) => s.p === name));
  const ADDR = (i) => FM.hex(i.addr != null ? i.addr : i.def.addr);

  const DRIVERS = {
    scd4x: [
      'class SCD4X:',
      '    """Minimal SCD40/SCD41 driver (Sensirion I2C commands)."""',
      '    def __init__(self, i2c, addr=0x62):',
      '        self.i2c, self.addr = i2c, addr',
      '        self.cmd(0x3F86)  # stop, in case it was already measuring',
      '        time.sleep_ms(500)',
      '        self.cmd(0x21B1)  # start periodic measurement (one reading every 5 s)',
      '',
      '    def cmd(self, c):',
      '        self.i2c.writeto(self.addr, bytes([c >> 8, c & 0xFF]))',
      '',
      '    def read(self):',
      '        self.cmd(0xE4B8)  # is data ready?',
      '        time.sleep_ms(1)',
      '        r = self.i2c.readfrom(self.addr, 3)',
      '        if ((r[0] << 8) | r[1]) & 0x07FF == 0:',
      '            return None',
      '        self.cmd(0xEC05)  # read measurement',
      '        time.sleep_ms(1)',
      '        d = self.i2c.readfrom(self.addr, 9)',
      '        co2 = (d[0] << 8) | d[1]',
      '        t = -45 + 175 * ((d[3] << 8) | d[4]) / 65535',
      '        h = 100 * ((d[6] << 8) | d[7]) / 65535',
      '        return co2, t, h',
    ].join('\n'),
    bme280: [
      'class BME280:',
      '    """Minimal BME280 driver: temperature (C), humidity (%), pressure (hPa)."""',
      '    def __init__(self, i2c, addr=0x76):',
      '        self.i2c, self.addr = i2c, addr',
      '        c = i2c.readfrom_mem(addr, 0x88, 24)',
      '        self.T1, self.T2, self.T3, self.P1, self.P2, self.P3, self.P4, self.P5, self.P6, self.P7, self.P8, self.P9 = struct.unpack("<HhhHhhhhhhhh", c)',
      '        self.H1 = i2c.readfrom_mem(addr, 0xA1, 1)[0]',
      '        e = i2c.readfrom_mem(addr, 0xE1, 7)',
      '        self.H2 = struct.unpack("<h", e[0:2])[0]',
      '        self.H3 = e[2]',
      '        h4 = (e[3] << 4) | (e[4] & 0x0F)',
      '        h5 = (e[5] << 4) | (e[4] >> 4)',
      '        self.H4 = h4 - 4096 if h4 > 2047 else h4',
      '        self.H5 = h5 - 4096 if h5 > 2047 else h5',
      '        self.H6 = struct.unpack("<b", e[6:7])[0]',
      '        i2c.writeto_mem(addr, 0xF2, b"\\x01")  # humidity x1',
      '        i2c.writeto_mem(addr, 0xF4, b"\\x27")  # temp x1, pressure x1, normal mode',
      '        i2c.writeto_mem(addr, 0xF5, b"\\xA0")',
      '        time.sleep_ms(50)',
      '',
      '    def read(self):',
      '        d = self.i2c.readfrom_mem(self.addr, 0xF7, 8)',
      '        adc_p = (d[0] << 12) | (d[1] << 4) | (d[2] >> 4)',
      '        adc_t = (d[3] << 12) | (d[4] << 4) | (d[5] >> 4)',
      '        adc_h = (d[6] << 8) | d[7]',
      '        v1 = (adc_t / 16384 - self.T1 / 1024) * self.T2',
      '        v2 = (adc_t / 131072 - self.T1 / 8192) ** 2 * self.T3',
      '        t_fine = v1 + v2',
      '        temp = t_fine / 5120',
      '        v1 = t_fine / 2 - 64000',
      '        v2 = v1 * v1 * self.P6 / 32768 + v1 * self.P5 * 2',
      '        v2 = v2 / 4 + self.P4 * 65536',
      '        v1 = (self.P3 * v1 * v1 / 524288 + self.P2 * v1) / 524288',
      '        v1 = (1 + v1 / 32768) * self.P1',
      '        pres = 0',
      '        if v1:',
      '            p = (1048576 - adc_p - v2 / 4096) * 6250 / v1',
      '            pres = (p + (self.P9 * p * p / 2147483648 + p * self.P8 / 32768 + self.P7) / 16) / 100',
      '        h = t_fine - 76800',
      '        h = (adc_h - (self.H4 * 64 + self.H5 / 16384 * h)) * (self.H2 / 65536 * (1 + self.H6 / 67108864 * h * (1 + self.H3 / 67108864 * h)))',
      '        h = max(0, min(100, h * (1 - self.H1 * h / 524288)))',
      '        return temp, h, pres',
    ].join('\n'),
    mpu6050: [
      'class MPU6050:',
      '    """Minimal MPU6050 driver: acceleration (m/s2), rotation (deg/s), temperature (C)."""',
      '    def __init__(self, i2c, addr=0x68):',
      '        self.i2c, self.addr = i2c, addr',
      '        i2c.writeto_mem(addr, 0x6B, b"\\x00")  # wake up',
      '',
      '    def read(self):',
      '        d = struct.unpack(">hhhhhhh", self.i2c.readfrom_mem(self.addr, 0x3B, 14))',
      '        a = [x / 16384 * 9.81 for x in d[0:3]]',
      '        g = [x / 131 for x in d[4:7]]',
      '        return a, g, d[3] / 340 + 36.53',
    ].join('\n'),
    lcd: [
      'class LCD:',
      '    """Minimal 16x2 LCD driver for the PCF8574 I2C backpack."""',
      '    def __init__(self, i2c, addr=0x27):',
      '        self.i2c, self.addr = i2c, addr',
      '        time.sleep_ms(50)',
      '        for n in (0x30, 0x30, 0x30, 0x20):',
      '            self._nibble(n)',
      '            time.sleep_ms(5)',
      '        for c in (0x28, 0x0C, 0x06, 0x01):',
      '            self._send(c, 0)',
      '        time.sleep_ms(2)',
      '',
      '    def _nibble(self, b):',
      '        self.i2c.writeto(self.addr, bytes([b | 0x0C]))  # backlight + enable',
      '        self.i2c.writeto(self.addr, bytes([(b | 0x08) & ~0x04]))',
      '',
      '    def _send(self, v, rs):',
      '        self._nibble((v & 0xF0) | rs)',
      '        self._nibble(((v << 4) & 0xF0) | rs)',
      '',
      '    def show(self, text):',
      '        self._send(0x01, 0)',
      '        time.sleep_ms(2)',
      '        for n, ch in enumerate(str(text)[:32]):',
      '            if n == 16:',
      '                self._send(0xC0, 0)  # second line',
      '            self._send(ord(ch), 1)',
    ].join('\n'),
    wrap: 'def wrap(text, width):\n    words, lines, line = str(text).split(), [], ""\n    for word in words:\n        if line and len(line) + 1 + len(word) > width:\n            lines.append(line)\n            line = word\n        else:\n            line = (line + " " + word).strip()\n    if line:\n        lines.append(line)\n    return lines',
  };

  const ANALOG = (key, expr) => ({
    imp: ['from machine import ADC'],
    init: (i, c) => i.var + ' = ADC(' + (c.board.family === 'esp8266' ? '0' : 'Pin(' + i.board.pins[i.adcPin].gpio + ')') + ')' + (c.board.family === 'esp32' ? '\n' + i.var + '.atten(ADC.ATTN_11DB)  # read the full 0-3.3 V range' : ''),
    read: (i) => 'level = ' + i.var + '.read_u16() / 65535  # 0.0 to 1.0\nreturn {"' + key + '": ' + expr + '}',
  });

  const MP = {
    scd40: { driver: 'scd4x', i2c: true,
      init: (i) => i.var + ' = SCD4X(i2c, ' + ADDR(i) + ')',
      read: (i) => 'for _ in range(20):\n    r = ' + i.var + '.read()\n    if r:\n        return {"co2": r[0], "temperature": round(r[1], 1), "humidity": round(r[2], 1)}\n    time.sleep_ms(500)\nreturn {}' },
    bme280: { driver: 'bme280', i2c: true, imp: ['import struct'],
      init: (i) => i.var + ' = BME280(i2c, ' + ADDR(i) + ')',
      read: (i) => 't, h, p = ' + i.var + '.read()\nreturn {"temperature": round(t, 1), "humidity": round(h, 1), "pressure": round(p, 1)}' },
    mpu6050: { driver: 'mpu6050', i2c: true, imp: ['import struct'],
      init: (i) => i.var + ' = MPU6050(i2c, ' + ADDR(i) + ')',
      read: (i) => 'a, g, t = ' + i.var + '.read()\nreturn {"ax": round(a[0], 2), "ay": round(a[1], 2), "az": round(a[2], 2),\n        "gx": round(g[0], 1), "gy": round(g[1], 1), "gz": round(g[2], 1), "temperature": round(t, 1)}' },
    bh1750: { i2c: true,
      init: (i) => 'i2c.writeto(' + ADDR(i) + ', b"\\x10")  # BH1750: continuous high-resolution mode',
      read: (i) => 'd = i2c.readfrom(' + ADDR(i) + ', 2)\nreturn {"lux": round(((d[0] << 8) | d[1]) / 1.2)}' },
    mhz19: { imp: ['from machine import UART'],
      init: (i, c) => (i.uart && i.uart.soft ? '# The ESP8266 has no spare serial port for the MH-Z19; use an ESP32 or Pico.\n' + i.var + ' = None' : i.var + ' = UART(' + i.uart.id + ', 9600, tx=Pin(' + gs(i, 'RX') + '), rx=Pin(' + gs(i, 'TX') + '))'),
      read: (i) => 'if not ' + i.var + ':\n    return {}\n' + i.var + '.read()  # clear old bytes\n' + i.var + '.write(b"\\xff\\x01\\x86\\x00\\x00\\x00\\x00\\x00\\x79")\ntime.sleep_ms(100)\nr = ' + i.var + '.read(9)\nif r and len(r) == 9 and r[0] == 0xFF and r[1] == 0x86:\n    return {"co2": r[2] * 256 + r[3]}\nreturn {}' },
    dht22: { imp: ['import dht'], init: (i) => i.var + ' = dht.DHT22(Pin(' + g(i, 1) + '))',
      read: (i) => 'try:\n    ' + i.var + '.measure()\n    return {"temperature": ' + i.var + '.temperature(), "humidity": ' + i.var + '.humidity()}\nexcept OSError:\n    return {}  # missed a reading; the next one usually works' },
    dht11: { imp: ['import dht'], init: (i) => i.var + ' = dht.DHT11(Pin(' + g(i, 1) + '))',
      read: (i) => 'try:\n    ' + i.var + '.measure()\n    return {"temperature": ' + i.var + '.temperature(), "humidity": ' + i.var + '.humidity()}\nexcept OSError:\n    return {}' },
    ds18b20: { imp: ['import onewire', 'import ds18x20'],
      init: (i, c) => c.once('w1_' + g(i, 2), 'probes = ds18x20.DS18X20(onewire.OneWire(Pin(' + g(i, 2) + ')))\nprobe_ids = probes.scan()\nprint("Found", len(probe_ids), "temperature probe(s)")'),
      read: (i) => 'if len(probe_ids) < ' + i.n + ':\n    return {}\nprobes.convert_temp()\ntime.sleep_ms(750)\nreturn {"temperature": round(probes.read_temp(probe_ids[' + (i.n - 1) + ']), 1)}' },
    hcsr04: { imp: ['from machine import time_pulse_us'],
      init: (i) => i.var + '_trig = Pin(' + gs(i, 'Trig') + ', Pin.OUT)\n' + i.var + '_echo = Pin(' + gs(i, 'Echo') + ', Pin.IN)',
      read: (i) => i.var + '_trig.value(0)\ntime.sleep_us(2)\n' + i.var + '_trig.value(1)\ntime.sleep_us(10)\n' + i.var + '_trig.value(0)\nus = time_pulse_us(' + i.var + '_echo, 1, 30000)\nreturn {"distance": round(us / 58, 1)} if us > 0 else {}' },
    pir: { init: (i) => i.var + ' = Pin(' + g(i, 1) + ', Pin.IN)', read: (i) => 'return {"motion": ' + i.var + '.value()}' },
    button: { init: (i) => i.var + ' = Pin(' + g(i, 0) + ', Pin.IN, Pin.PULL_UP)', read: (i) => 'return {"pressed": 1 - ' + i.var + '.value()}  # pressed pulls the pin to GND' },
    mq135: ANALOG('air', 'round(level * 100)'),
    ldr: ANALOG('light', 'round(level * 100)'),
    pot: ANALOG('knob', 'round(level * 100)'),
    soil: Object.assign(ANALOG('moisture', 'max(0, min(100, round((DRY - level) / (DRY - WET) * 100)))'), {
      init: (i, c) => { c.setting('DRY = 0.80   # soil probe level in dry air (0-1, measure yours)\nWET = 0.35   # soil probe level in water'); return ANALOG().init(i, c); },
    }),
    oled: { libs: ['mip-ssd1306'], imp: ['import ssd1306'], i2c: true, driver: 'wrap',
      init: (i) => i.var + ' = ssd1306.SSD1306_I2C(128, 64, i2c, addr=' + ADDR(i) + ')\n\ndef show_' + i.var + '(text):\n    ' + i.var + '.fill(0)\n    for row, line in enumerate(wrap(text, 16)[:6]):\n        ' + i.var + '.text(line, 0, row * 10)\n    ' + i.var + '.show()',
      acts: { show: (i) => 'show_' + i.var + '(msg)' } },
    lcd1602: { driver: 'lcd', i2c: true, init: (i) => i.var + ' = LCD(i2c, ' + ADDR(i) + ')', acts: { show: (i) => i.var + '.show(msg)' } },
    tm1637: { libs: ['mip-tm1637'], imp: ['import tm1637'],
      init: (i) => i.var + ' = tm1637.TM1637(clk=Pin(' + gs(i, 'CLK') + '), dio=Pin(' + gs(i, 'DIO') + '))',
      acts: { number: (i, a) => 'if v.get("' + a.key + '") is not None:\n    ' + i.var + '.number(int(v["' + a.key + '"]))' } },
    led: { init: (i) => i.var + ' = Pin(' + g(i, 0) + ', Pin.OUT)',
      acts: { onwhile: (i) => i.var + '.value(1 if alert else 0)', blink: (i, a) => 'for _ in range(' + (a.n || 3) + '):\n    ' + i.var + '.value(1)\n    time.sleep_ms(200)\n    ' + i.var + '.value(0)\n    time.sleep_ms(200)' } },
    rgbled: { imp: ['from machine import PWM'],
      init: (i) => ['Red leg', 'Green leg', 'Blue leg'].map((n, k) => i.var + '_' + 'rgb'[k] + ' = PWM(Pin(' + gs(i, n) + '), freq=1000)').join('\n'),
      acts: { colour: (i, a) => { const c1 = FM.hexColour(a.colour), c2 = FM.hexColour(a.colour2 || '#000000'); return 'colour = (' + c1.join(', ') + ') if alert else (' + c2.join(', ') + ')\n' + 'rgb'.split('').map((ch, k) => i.var + '_' + ch + '.duty_u16(colour[' + k + '] * 257)').join('\n'); } } },
    buzzer: { init: (i) => i.var + ' = Pin(' + g(i, 0) + ', Pin.OUT)',
      acts: { beep: (i, a) => 'for _ in range(' + (a.n || 3) + '):\n    ' + i.var + '.value(1)\n    time.sleep_ms(100)\n    ' + i.var + '.value(0)\n    time.sleep_ms(100)' } },
    servo: { imp: ['from machine import PWM'],
      init: (i) => i.var + ' = PWM(Pin(' + g(i, 2) + '), freq=50)\n\ndef ' + i.var + '_angle(deg):\n    deg = max(0, min(180, deg))\n    ' + i.var + '.duty_u16(int((0.5 + deg / 180 * 2.0) / 20 * 65535))  # 0.5-2.5 ms pulse',
      acts: {
        angle: (i, a, lim) => i.var + '_angle(' + (lim ? (a.angle || 0) + ' if alert else ' + (a.angle2 || 0) : (a.angle || 0)) + ')',
        follow: (i, a) => 'x = v.get("' + a.key + '")\nif x is not None:\n    ' + i.var + '_angle((x - ' + (a.min || 0) + ') / (' + (a.max || 100) + ' - ' + (a.min || 0) + ') * 180)',
      } },
    relay: { init: (i) => i.var + ' = Pin(' + g(i, 2) + ', Pin.OUT, value=1)  # most relay modules switch on when LOW',
      acts: { onwhile: (i) => i.var + '.value(0 if alert else 1)' } },
    ws2812: { imp: ['import neopixel'],
      init: (i, c) => { c.setting('LED_COUNT = 8   # how many LEDs are on your strip'); return i.var + ' = neopixel.NeoPixel(Pin(' + g(i, 2) + '), LED_COUNT)'; },
      acts: { colour: (i, a) => i.var + '.fill((' + FM.hexColour(a.colour).join(', ') + ') if alert else (' + FM.hexColour(a.colour2 || '#000000').join(', ') + '))\n' + i.var + '.write()' } },
    stepper: {
      init: (i) => i.var + '_coils = [Pin(p, Pin.OUT) for p in (' + [0, 1, 2, 3].map((k) => g(i, k)).join(', ') + ')]\nSTEP_SEQ = [[1,0,0,0],[1,1,0,0],[0,1,0,0],[0,1,1,0],[0,0,1,0],[0,0,1,1],[0,0,0,1],[1,0,0,1]]\n\ndef turn_' + i.var + '(steps):  # 4096 half-steps = one full turn\n    for s in range(abs(steps)):\n        pattern = STEP_SEQ[s % 8 if steps > 0 else 7 - s % 8]\n        for coil, on in zip(' + i.var + '_coils, pattern):\n            coil.value(on)\n        time.sleep_ms(1)\n    for coil in ' + i.var + '_coils:\n        coil.value(0)',
      acts: { turn: (i, a) => 'turn_' + i.var + '(' + (a.steps || 512) + ')' } },
  };
  FM.MP_PARTS = MP;

  function i2cInit(board) {
    const b = board.bus.i2c;
    const sda = board.pins[b.sda].gpio, scl = board.pins[b.scl].gpio;
    if (b.soft) return 'i2c = SoftI2C(sda=Pin(' + sda + '), scl=Pin(' + scl + '))';
    return 'i2c = I2C(' + (b.id || 0) + ', sda=Pin(' + sda + '), scl=Pin(' + scl + '), freq=100000)';
  }

  FM.gen.micropython = function (A, prog, meta) {
    const board = A.board;
    const imports = new Set(['import time', 'from machine import Pin']);
    const libs = new Set();
    const settings = [], helpers = [], inits = [], drivers = [];
    const done = {}, onceKeys = {};
    let needI2C = false;
    const ctx = {
      board,
      need(uid) { use(A.byUid[uid]); return A.byUid[uid]; },
      setting(s) { if (!settings.includes(s)) settings.push(s); },
      once(key, code) { if (onceKeys[key]) return ''; onceKeys[key] = true; return code; },
    };
    function use(i) {
      if (!i || done[i.uid]) return i;
      done[i.uid] = true;
      i.board = board;
      const s = MP[i.def.id];
      if (!s) { inits.push('# ' + i.label + ': no MicroPython code for this part yet'); return i; }
      (s.libs || []).forEach((l) => libs.add(l));
      (s.imp || []).forEach((l) => imports.add(l));
      if (s.driver && !drivers.includes(DRIVERS[s.driver])) drivers.push(DRIVERS[s.driver]);
      if (s.i2c) { needI2C = true; imports.add(board.bus.i2c.soft ? 'from machine import SoftI2C' : 'from machine import I2C'); }
      const code = s.init ? s.init(i, ctx) : '';
      if (code) inits.push('# ' + i.label + '\n' + code);
      if (s.read) helpers.push('def read_' + i.var + '():\n' + FM.indent(s.read(i, ctx), 1));
      return i;
    }

    const names = FM.programNames(A, prog);
    const boolNames = names.filter((n) => n.bool).map((n) => n.name);
    const limit = (prog.steps || []).find((s) => s.t === 'limit');
    const body = FM.Writer();
    const readers = {};
    (prog.reads || []).forEach((r) => {
      if (r.uid === 'sys') { readers.sys = true; return; }
      const i = A.byUid[r.uid];
      if (i && i.supported) { use(i); readers[i.uid] = i; }
    });

    let sysUsed = false;
    const sysHelper = () => {
      if (sysUsed) return; sysUsed = true;
      if (board.internalTemp) { imports.add('from machine import ADC'); helpers.push('_chip = ADC(4)  # the Pico\u2019s built-in temperature sensor\n\ndef read_board():\n    volts = _chip.read_u16() * 3.3 / 65535\n    return {"chip_temp": round(27 - (volts - 0.706) / 0.001721, 1), "uptime": time.ticks_diff(time.ticks_ms(), START) // 1000}'); }
      else helpers.push('def read_board():\n    return {"uptime": time.ticks_diff(time.ticks_ms(), START) // 1000}');
    };

    let main;
    if (prog.mode === 'listen') main = listenBody(A, prog, { use, imports, helpers, sysHelper });
    else {
      body.line('v = {}');
      Object.entries(readers).forEach(([uid, i]) => {
        if (uid === 'sys') { sysHelper(); body.line('r = read_board()'); }
        else body.line('r = read_' + i.var + '()');
        prog.reads.filter((r) => r.uid === uid).forEach((r) => body.line('v["' + r.name + '"] = r.get("' + r.k + '")'));
      });
      (prog.steps || []).forEach((s) => {
        if (s.t === 'math') body.line('v["' + s.target + '"] = calc(v.get("' + s.a + '"), lambda x: ' + FM.pyMath.mathExpr(s, 'x', 'v') + ')  # ' + FM.pyMath.mathLabel(s));
        if (s.t === 'smooth') body.line('v["' + s.key + '"] = smooth("' + s.key + '", v.get("' + s.key + '"), ' + (s.n || 5) + ')');
        if (s.t === 'convert') body.line('v["' + s.key + '"] = calc(v.get("' + s.key + '"), lambda c: round(c * 9 / 5 + 32, 1))  # \u00b0C to \u00b0F');
      });
      if (limit) { ctx.setting('LIMIT = ' + (limit.val == null ? 0 : limit.val)); body.line('alert = ' + FM.pyMath.limitExpr(limit)); }
      else body.line('alert = True');
      (prog.actions || []).forEach((a) => {
        const tpl = a.msg || prog.message || FM.defaultMessage(A, prog);
        let label, code, msg = false, always = false;
        if (a.uid === 'print') { label = 'Print to the serial console'; code = 'print(msg)'; msg = true; }
        else if (a.uid === 'log') {
          label = 'Save to log.csv on the board';
          helpers.push('def log_csv(values):\n    with open("log.csv", "a") as f:\n        f.write(",".join([str(time.time())] + [str(x) for x in values.values()]) + "\\n")');
          code = 'log_csv(v)';
        } else {
          const i = A.byUid[a.uid];
          if (!i || !i.supported) return;
          use(i);
          const s = MP[i.def.id];
          const f = s && s.acts && s.acts[a.act];
          const def = i.def.actions.find((x) => x.k === a.act);
          label = i.label + ': ' + (def ? def.l.toLowerCase() : a.act);
          code = f ? f(i, a, !!limit) : '# not available in MicroPython yet';
          msg = !!(def && def.msg);
          always = a.act === 'onwhile' || (a.act === 'angle' && !!limit) || a.act === 'colour';
        }
        const cond = [];
        if (a.when === 'alert') cond.push('alert');
        if (a.when === 'calm') cond.push('not alert');
        if (a.every > 0) cond.push('ready("' + a.id + '", ' + a.every + ')');
        body.blank().line('# ' + label + ', ' + FM.whenText(a));
        const full = (msg ? 'msg = fmt(' + FM.pyStr(tpl) + ', v)\n' : '') + code;
        if (cond.length && !always) body.line('if ' + cond.join(' and ') + ':').in().line(full).out();
        else body.line(full);
      });
    }

    const w = FM.Writer();
    const mip = Array.from(libs).map((id) => FM.libraries[id]).filter((l) => l && l.kind === 'mip').map((l) => l.pkg);
    w.line('# ' + (meta.title || 'My project') + ' \u2014 made with friendly-microman for ' + board.name);
    w.line('# Save this file on the board as main.py so it runs every time the board starts.');
    if (mip.length) { w.line('#'); w.line('# Libraries to install once (from your computer):'); mip.forEach((m) => w.line('#   mpremote mip install ' + m)); }
    w.blank();
    w.line(Array.from(imports).sort((a, b) => (a.startsWith('from') - b.startsWith('from')) || a.localeCompare(b)).join('\n')).blank();
    if (drivers.length) w.line('# ---------- Small built-in drivers ----------').line(drivers.join('\n\n\n')).blank().blank();
    if (needI2C) w.line(i2cInit(board) + '  # shared I2C bus').blank();
    if (inits.length) w.line('# ---------- Parts ----------').line(inits.join('\n\n')).blank();
    w.line('# ---------- Settings you can change ----------').line('INTERVAL = ' + (prog.interval || 5) + '   # seconds between readings');
    settings.forEach((s) => w.line(s));
    if (boolNames.length) w.line('YES_NO = (' + boolNames.map((n) => '"' + n + '"').join(', ') + ',)');
    w.blank().line(MP_HELPERS(boolNames.length > 0)).blank();
    if (helpers.length) w.line(helpers.join('\n\n')).blank();
    if (prog.mode === 'listen') w.line(main);
    else {
      w.blank().line('def loop():').in().line(body.text().trimEnd()).out().blank().blank();
      w.line('print("Running. Press Ctrl+C to stop.")').line('while True:').in().line('loop()').line('time.sleep(INTERVAL)').out();
    }
    return { code: w.text(), libs: Array.from(libs) };
  };

  function MP_HELPERS(yesNo) {
    return [
      'START = time.ticks_ms()',
      '_last_run = {}',
      '_history = {}',
      '',
      '',
      'def fmt(template, values):',
      '    """Fill {names} in a message with the latest values."""',
      '    out = template',
      '    for key, x in values.items():',
      '        if x is None:',
      '            x = "?"',
      yesNo ? '        elif key in YES_NO:\n            x = "yes" if x else "no"' : null,
      '        elif isinstance(x, float):',
      '            x = round(x, 1)',
      '        out = out.replace("{" + key + "}", str(x))',
      '    return out',
      '',
      '',
      'def calc(x, f):',
      '    return None if x is None else f(x)',
      '',
      '',
      'def smooth(key, x, n):',
      '    if x is None:',
      '        return None',
      '    h = _history.setdefault(key, [])',
      '    h.append(x)',
      '    while len(h) > n:',
      '        h.pop(0)',
      '    return round(sum(h) / len(h), 1)',
      '',
      '',
      'def ready(name, seconds):',
      '    now = time.ticks_ms()',
      '    if name not in _last_run or time.ticks_diff(now, _last_run[name]) >= seconds * 1000:',
      '        _last_run[name] = now',
      '        return True',
      '    return False',
    ].filter((l) => l !== null).join('\n');
  }

  // Typed command listener over the USB serial console.
  function listenBody(A, prog, t) {
    const L = prog.listen || { rules: [] };
    const w = FM.Writer();
    const replies = [];
    (L.replies || ['print']).forEach((r) => {
      if (r === 'print') replies.push('print("Board:", text)');
      else { const i = A.byUid[r]; if (i && i.supported && MP[i.def.id] && MP[i.def.id].acts && MP[i.def.id].acts.show) { t.use(i); replies.push(i.def.id === 'oled' ? 'show_' + i.var + '(text)' : i.var + '.show(text)'); } }
    });
    if (!replies.length) replies.push('print("Board:", text)');
    w.line('def reply(text):').in().line(replies.join('\n')).out().blank().blank();
    w.line('def handle(text):').in().line('text = text.lower().strip()');
    let first = true;
    (L.rules || []).forEach((r) => {
      const words = String(r.say || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (!words.length) return;
      w.line((first ? 'if ' : 'elif ') + (words.length === 1 ? FM.pyStr(words[0]) + ' in text' : 'any(x in text for x in (' + words.map(FM.pyStr).join(', ') + '))') + ':').in();
      first = false;
      if (r.do === 'time') w.line('reply("Running for " + str(time.ticks_diff(time.ticks_ms(), START) // 1000) + " seconds")');
      else if (r.do === 'text') w.line('reply(' + FM.pyStr(r.text || 'Hello!') + ')');
      else if (r.do === 'stop') w.line('reply("Goodbye")').line('return False');
      else if (r.do === 'reading') {
        if (r.uid === 'sys') { t.sysHelper(); w.line('reply(fmt(' + FM.pyStr(r.text || '{value}') + ', {"value": read_board().get("' + r.k + '")}))'); }
        else { const i = A.byUid[r.uid]; if (i && i.supported) { t.use(i); w.line('reply(fmt(' + FM.pyStr(r.text || '{value}') + ', {"value": read_' + i.var + '().get("' + r.k + '")}))'); } else w.line('reply("That sensor is not connected")'); }
      } else if (r.do === 'on' || r.do === 'off') {
        const i = A.byUid[r.uid];
        if (i && i.supported) { t.use(i); const on = r.do === 'on'; const val = i.def.id === 'relay' ? (on ? 0 : 1) : (on ? 1 : 0); w.line(i.var + '.value(' + val + ')').line('reply("' + i.short + ' ' + r.do + '")'); }
        else w.line('reply("That part is not connected")');
      } else w.line('pass');
      w.out();
    });
    if (!first) w.line('else:').in().line('reply("Sorry, I do not know that command")').out();
    w.line('return True').out().blank().blank();
    w.line('print("Type a command in the serial monitor and press Enter.")').line('while handle(input("> ")):').in().line('pass').out();
    return w.text();
  }
})();
