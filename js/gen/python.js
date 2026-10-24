/* Python 3 generator for Raspberry Pi (gpiozero + Adafruit Blinka drivers). */
(function () {
  const g = (i, idx) => { const id = i.pins[idx]; return id ? i.board.pins[id].gpio : '?'; };
  const gs = (i, name) => g(i, i.def.sig.findIndex((s) => s.p === name));
  const ADDR = (i) => FM.hex(i.addr != null ? i.addr : i.def.addr);
  const SAY = {
    libs: ['espeak'], imp: ['import subprocess'],
    helper: 'def speak(text):\n    # Uses the Pi\u2019s default sound output. Pick it from the speaker icon on the desktop if needed.\n    subprocess.run(["espeak-ng", "-s", "150", str(text)])',
    acts: { say: (i, a) => 'speak(msg)' },
  };
  const ANALOG = (key, expr) => ({
    libs: [], imp: [],
    init: (i, c) => { const adc = c.need(i.adc.uid); return i.var + ' = AnalogIn(' + adc.var + ', ADS.P' + i.adc.ch + ')'; },
    read: (i) => 'volts = ' + i.var + '.voltage\nreturn {"' + key + '": ' + expr + '}',
  });

  const PY = {
    scd40: {
      libs: ['blinka', 'py-scd4x'], imp: ['import adafruit_scd4x'], i2c: true,
      init: (i) => i.var + ' = adafruit_scd4x.SCD4X(i2c, address=' + ADDR(i) + ')\n' + i.var + '.start_periodic_measurement()\nprint("SCD40 warming up, the first reading takes about 5 seconds...")',
      read: (i) => 'for _ in range(20):  # a new value is ready every 5 seconds\n    if ' + i.var + '.data_ready:\n        return {"co2": ' + i.var + '.CO2, "temperature": round(' + i.var + '.temperature, 1), "humidity": round(' + i.var + '.relative_humidity, 1)}\n    time.sleep(0.5)\nreturn {}',
    },
    scd30: {
      libs: ['blinka', 'py-scd30'], imp: ['import adafruit_scd30'], i2c: true,
      init: (i) => i.var + ' = adafruit_scd30.SCD30(i2c)',
      read: (i) => 'for _ in range(10):\n    if ' + i.var + '.data_available:\n        return {"co2": round(' + i.var + '.CO2), "temperature": round(' + i.var + '.temperature, 1), "humidity": round(' + i.var + '.relative_humidity, 1)}\n    time.sleep(0.5)\nreturn {}',
    },
    mhz19: {
      libs: ['pyserial'], imp: ['import serial'],
      init: (i) => i.var + ' = serial.Serial("' + ((i.uart && i.uart.dev) || '/dev/serial0') + '", 9600, timeout=2)' + (i.uart && i.uart.extra ? '  # check the name with: ls /dev/ttyAMA*' : ''),
      read: (i) => i.var + '.reset_input_buffer()\n' + i.var + '.write(b"\\xff\\x01\\x86\\x00\\x00\\x00\\x00\\x00\\x79")  # "give me CO2"\nr = ' + i.var + '.read(9)\nif len(r) == 9 and r[0] == 0xFF and r[1] == 0x86:\n    return {"co2": r[2] * 256 + r[3]}\nreturn {}',
    },
    sgp30: {
      libs: ['blinka', 'py-sgp30'], imp: ['import adafruit_sgp30'], i2c: true,
      init: (i) => i.var + ' = adafruit_sgp30.Adafruit_SGP30(i2c)\n' + i.var + '.iaq_init()',
      read: (i) => 'return {"eco2": ' + i.var + '.eCO2, "tvoc": ' + i.var + '.TVOC}',
    },
    mq135: ANALOG('air', 'round(volts / 3.3 * 100)'),
    bme280: {
      libs: ['blinka', 'py-bme280'], imp: ['from adafruit_bme280 import basic as adafruit_bme280'], i2c: true,
      init: (i) => i.var + ' = adafruit_bme280.Adafruit_BME280_I2C(i2c, address=' + ADDR(i) + ')',
      read: (i) => 'return {"temperature": round(' + i.var + '.temperature, 1), "humidity": round(' + i.var + '.relative_humidity, 1), "pressure": round(' + i.var + '.pressure, 1)}',
    },
    dht22: {
      libs: ['blinka', 'py-dht'], imp: ['import board', 'import adafruit_dht'],
      init: (i) => i.var + ' = adafruit_dht.DHT22(board.D' + g(i, 1) + ')',
      read: (i) => 'try:\n    return {"temperature": ' + i.var + '.temperature, "humidity": ' + i.var + '.humidity}\nexcept RuntimeError:\n    return {}  # DHT sensors miss a reading now and then; the next one usually works',
    },
    dht11: {
      libs: ['blinka', 'py-dht'], imp: ['import board', 'import adafruit_dht'],
      init: (i) => i.var + ' = adafruit_dht.DHT11(board.D' + g(i, 1) + ')',
      read: (i) => 'try:\n    return {"temperature": ' + i.var + '.temperature, "humidity": ' + i.var + '.humidity}\nexcept RuntimeError:\n    return {}',
    },
    ds18b20: {
      imp: ['import glob'],
      init: () => '',
      read: (i) => 'probes = sorted(glob.glob("/sys/bus/w1/devices/28-*/w1_slave"))\nif len(probes) < ' + i.n + ':\n    return {}\nwith open(probes[' + (i.n - 1) + ']) as f:\n    lines = f.read().splitlines()\nif not lines or not lines[0].endswith("YES"):\n    return {}\nreturn {"temperature": round(int(lines[1].split("t=")[1]) / 1000, 1)}',
    },
    hcsr04: {
      imp: ['from gpiozero import DistanceSensor'],
      init: (i) => i.var + ' = DistanceSensor(echo=' + gs(i, 'Echo') + ', trigger=' + gs(i, 'Trig') + ', max_distance=4)',
      read: (i) => 'return {"distance": round(' + i.var + '.distance * 100, 1)}',
    },
    pir: {
      imp: ['from gpiozero import MotionSensor'],
      init: (i) => i.var + ' = MotionSensor(' + g(i, 1) + ')',
      read: (i) => 'return {"motion": 1 if ' + i.var + '.motion_detected else 0}',
    },
    button: {
      imp: ['from gpiozero import Button'],
      init: (i) => i.var + ' = Button(' + g(i, 0) + ')  # uses the built-in pull-up',
      read: (i) => 'return {"pressed": 1 if ' + i.var + '.is_pressed else 0}',
    },
    mpu6050: {
      libs: ['blinka', 'py-mpu6050'], imp: ['import adafruit_mpu6050', 'import math'], i2c: true,
      init: (i) => i.var + ' = adafruit_mpu6050.MPU6050(i2c, address=' + ADDR(i) + ')',
      read: (i) => 'ax, ay, az = ' + i.var + '.acceleration\ngx, gy, gz = (math.degrees(r) for r in ' + i.var + '.gyro)\nreturn {"ax": round(ax, 2), "ay": round(ay, 2), "az": round(az, 2),\n        "gx": round(gx, 1), "gy": round(gy, 1), "gz": round(gz, 1), "temperature": round(' + i.var + '.temperature, 1)}',
    },
    bh1750: {
      libs: ['blinka', 'py-bh1750'], imp: ['import adafruit_bh1750'], i2c: true,
      init: (i) => i.var + ' = adafruit_bh1750.BH1750(i2c, address=' + ADDR(i) + ')',
      read: (i) => 'return {"lux": round(' + i.var + '.lux)}',
    },
    ldr: ANALOG('light', 'round(volts / 3.3 * 100)'),
    pot: ANALOG('knob', 'round(volts / 3.3 * 100)'),
    soil: Object.assign(ANALOG('moisture', 'max(0, min(100, round((DRY_VOLTS - volts) / (DRY_VOLTS - WET_VOLTS) * 100)))'), {
      init: (i, c) => { const adc = c.need(i.adc.uid); c.setting('DRY_VOLTS = 2.6   # soil probe reading in dry air (measure yours)\nWET_VOLTS = 1.1   # soil probe reading in a glass of water'); return i.var + ' = AnalogIn(' + adc.var + ', ADS.P' + i.adc.ch + ')'; },
    }),
    ads1115: {
      libs: ['blinka', 'py-ads1x15'], imp: ['import adafruit_ads1x15.ads1115 as ADS', 'from adafruit_ads1x15.analog_in import AnalogIn'], i2c: true,
      init: (i) => i.var + ' = ADS.ADS1115(i2c, address=' + ADDR(i) + ')',
    },
    oled: {
      libs: ['blinka', 'py-ssd1306', 'pillow'], imp: ['import adafruit_ssd1306', 'import textwrap', 'from PIL import Image, ImageDraw'], i2c: true,
      init: (i) => i.var + ' = adafruit_ssd1306.SSD1306_I2C(128, 64, i2c, addr=' + ADDR(i) + ')\n\ndef show_' + i.var + '(text):\n    image = Image.new("1", (128, 64))\n    draw = ImageDraw.Draw(image)\n    for row, line in enumerate(textwrap.wrap(str(text), 21)[:6]):\n        draw.text((0, row * 10), line, fill=255)\n    ' + i.var + '.image(image)\n    ' + i.var + '.show()',
      acts: { show: (i) => 'show_' + i.var + '(msg)' },
    },
    lcd1602: {
      libs: ['rplcd'], imp: ['from RPLCD.i2c import CharLCD'],
      init: (i) => i.var + ' = CharLCD("PCF8574", ' + ADDR(i) + ', cols=16, rows=2)\n\ndef show_' + i.var + '(text):\n    ' + i.var + '.clear()\n    ' + i.var + '.write_string(str(text)[:32])',
      acts: { show: (i) => 'show_' + i.var + '(msg)' },
    },
    tm1637: {
      libs: ['py-tm1637'], imp: ['import tm1637'],
      init: (i) => i.var + ' = tm1637.TM1637(clk=' + gs(i, 'CLK') + ', dio=' + gs(i, 'DIO') + ')',
      acts: { number: (i, a) => 'if v.get("' + a.key + '") is not None:\n    ' + i.var + '.number(int(v["' + a.key + '"]))' },
    },
    led: {
      imp: ['from gpiozero import LED'],
      init: (i) => i.var + ' = LED(' + g(i, 0) + ')',
      acts: { onwhile: (i) => i.var + '.value = 1 if alert else 0', blink: (i, a) => i.var + '.blink(on_time=0.2, off_time=0.2, n=' + (a.n || 3) + ', background=True)' },
    },
    rgbled: {
      imp: ['from gpiozero import RGBLED'],
      init: (i) => i.var + ' = RGBLED(red=' + gs(i, 'Red leg') + ', green=' + gs(i, 'Green leg') + ', blue=' + gs(i, 'Blue leg') + ')',
      acts: { colour: (i, a) => { const c1 = FM.hexColour(a.colour).map((x) => +(x / 255).toFixed(2)), c2 = FM.hexColour(a.colour2 || '#000000').map((x) => +(x / 255).toFixed(2)); return i.var + '.color = (' + c1.join(', ') + ') if alert else (' + c2.join(', ') + ')'; } },
    },
    buzzer: {
      imp: ['from gpiozero import Buzzer'],
      init: (i) => i.var + ' = Buzzer(' + g(i, 0) + ')',
      acts: { beep: (i, a) => i.var + '.beep(on_time=0.1, off_time=0.1, n=' + (a.n || 3) + ', background=True)' },
    },
    i2samp: SAY, usbspk: SAY, jackspk: SAY, hdmi: SAY,
    servo: {
      imp: ['from gpiozero import AngularServo'],
      init: (i) => i.var + ' = AngularServo(' + g(i, 2) + ', min_angle=0, max_angle=180, min_pulse_width=0.0005, max_pulse_width=0.0025)',
      acts: {
        angle: (i, a, hasLimit) => i.var + '.angle = ' + (hasLimit ? (a.angle || 0) + ' if alert else ' + (a.angle2 || 0) : (a.angle || 0)),
        follow: (i, a) => 'x = v.get("' + a.key + '")\nif x is not None:\n    ' + i.var + '.angle = max(0, min(180, (x - ' + (a.min || 0) + ') / (' + (a.max || 100) + ' - ' + (a.min || 0) + ') * 180))',
      },
    },
    relay: {
      imp: ['from gpiozero import OutputDevice'],
      init: (i) => i.var + ' = OutputDevice(' + g(i, 2) + ', active_high=False, initial_value=False)  # most relay modules switch on when the pin is LOW',
      acts: { onwhile: (i) => i.var + '.value = 1 if alert else 0' },
    },
    ws2812: {
      libs: ['blinka', 'py-neopixel'], imp: ['import board', 'import neopixel'],
      init: (i, c) => { c.setting('LED_COUNT = 8   # how many LEDs are on your strip'); return i.var + ' = neopixel.NeoPixel(board.D' + g(i, 2) + ', LED_COUNT, brightness=0.3)  # run with sudo'; },
      acts: { colour: (i, a) => i.var + '.fill((' + FM.hexColour(a.colour).join(', ') + ') if alert else (' + FM.hexColour(a.colour2 || '#000000').join(', ') + '))' },
    },
    stepper: {
      imp: ['from gpiozero import OutputDevice'],
      init: (i) => i.var + '_coils = [OutputDevice(p) for p in (' + [0, 1, 2, 3].map((k) => g(i, k)).join(', ') + ')]\n' + i.var + '_seq = [[1,0,0,0],[1,1,0,0],[0,1,0,0],[0,1,1,0],[0,0,1,0],[0,0,1,1],[0,0,0,1],[1,0,0,1]]\n\ndef turn_' + i.var + '(steps):  # 4096 half-steps = one full turn\n    for s in range(abs(steps)):\n        pattern = ' + i.var + '_seq[s % 8 if steps > 0 else 7 - s % 8]\n        for coil, on in zip(' + i.var + '_coils, pattern):\n            coil.value = on\n        time.sleep(0.001)\n    for coil in ' + i.var + '_coils:\n        coil.off()',
      acts: { turn: (i, a) => 'turn_' + i.var + '(' + (a.steps || 512) + ')' },
    },
    camera: {
      libs: ['picamera2'], imp: ['from picamera2 import Picamera2'],
      init: (i) => i.var + ' = Picamera2()\n' + i.var + '.start()\n\ndef take_photo():\n    name = time.strftime("photo_%Y%m%d_%H%M%S.jpg")\n    ' + i.var + '.capture_file(name)\n    print("Saved", name)',
      acts: { photo: () => 'take_photo()' },
    },
    usbmic: { libs: ['vosk', 'portaudio'] },
  };
  FM.PY_PARTS = PY;

  FM.gen.python = function (A, prog, meta) {
    const imports = new Set(['import time']);
    const libs = new Set(['gpiozero']);
    const settings = [];
    const helpers = [];
    const inits = [];
    const done = {};
    let needI2C = false;
    const ctx = {
      need(uid) { use(A.byUid[uid]); return A.byUid[uid]; },
      setting(s) { if (!settings.includes(s)) settings.push(s); },
      helper(s) { if (!helpers.includes(s)) helpers.push(s); },
    };
    function use(i) {
      if (!i || done[i.uid]) return i;
      done[i.uid] = true;
      i.board = A.board;
      const s = PY[i.def.id];
      if (!s) { inits.push('# ' + i.label + ': no Python code for this part yet'); return i; }
      (s.libs || []).forEach((l) => libs.add(l));
      (s.imp || []).forEach((l) => imports.add(l));
      if (s.i2c) { needI2C = true; imports.add('import board'); }
      if (s.helper) ctx.helper(s.helper);
      const code = s.init ? s.init(i, ctx) : '';
      if (code) inits.push('# ' + i.label + '\n' + code);
      if (s.read) helpers.push('def read_' + i.var + '():\n' + FM.indent(s.read(i, ctx), 1));
      return i;
    }

    const names = FM.programNames(A, prog);
    const boolNames = names.filter((n) => n.bool).map((n) => n.name);
    const limit = (prog.steps || []).find((s) => s.t === 'limit');
    const w = FM.Writer();

    // ----- body of the loop -----
    const body = FM.Writer();
    const readers = {};
    (prog.reads || []).forEach((r) => {
      if (r.uid === 'sys') { readers.sys = true; return; }
      const i = A.byUid[r.uid];
      if (i && i.supported) { use(i); readers[i.uid] = i; }
    });

    if (prog.mode === 'listen') return listen(A, prog, meta, { use, imports, libs, settings, helpers, inits, ctx, boolNames, needI2C: () => needI2C });

    body.line('v = {}');
    Object.values(readers).forEach((i) => {
      if (i === true) return;
      body.line('r = read_' + i.var + '()');
      prog.reads.filter((r) => r.uid === i.uid).forEach((r) => body.line('v["' + r.name + '"] = r.get("' + r.k + '")'));
    });
    if (readers.sys) {
      helpers.push(sysHelper(A.board));
      body.line('r = read_board()');
      prog.reads.filter((r) => r.uid === 'sys').forEach((r) => body.line('v["' + r.name + '"] = r.get("' + r.k + '")'));
    }
    (prog.steps || []).forEach((s) => {
      if (s.t === 'math') body.line('v["' + s.target + '"] = calc(v.get("' + s.a + '"), lambda x: ' + mathExpr(s, 'x', 'v') + ')  # ' + mathLabel(s));
      if (s.t === 'smooth') body.line('v["' + s.key + '"] = smooth("' + s.key + '", v.get("' + s.key + '"), ' + (s.n || 5) + ')  # average of the last ' + (s.n || 5) + ' readings');
      if (s.t === 'convert') body.line('v["' + s.key + '"] = calc(v.get("' + s.key + '"), lambda c: round(c * 9 / 5 + 32, 1))  # \u00b0C to \u00b0F');
    });
    if (limit) {
      ctx.setting('LIMIT = ' + (limit.val == null ? 0 : limit.val) + '   # the check below compares against this');
      body.line('alert = ' + limitExpr(limit) + '  # the check');
    } else body.line('alert = True  # no check added, so "when the check is true" means always');

    let msgUsed = false;
    (prog.actions || []).forEach((a, k) => {
      const tpl = a.msg || prog.message || FM.defaultMessage(A, prog);
      const runs = actionCode(A, a, k, { use, libs, imports, helpers, ctx, prog, hasLimit: !!limit });
      if (!runs) return;
      const cond = [];
      if (a.when === 'alert') cond.push('alert');
      if (a.when === 'calm') cond.push('not alert');
      if (a.every > 0) cond.push('ready("' + a.id + '", ' + a.every + ')');
      body.blank().line('# ' + runs.label + ', ' + FM.whenText(a) + (a.every > 0 ? ', at most every ' + a.every + ' s' : ''));
      const code = (runs.msg ? 'msg = fmt(' + FM.pyStr(tpl) + ', v)\n' : '') + runs.code;
      if (runs.msg) msgUsed = true;
      if (cond.length && !runs.always) { body.line('if ' + cond.join(' and ') + ':').in().line(code).out(); }
      else body.line(code);
    });

    // ----- assemble -----
    header(w, A, prog, meta, libs);
    w.line(Array.from(imports).sort(importOrder).join('\n')).blank();
    if (needI2C) w.line('i2c = board.I2C()  # shared I2C bus (SDA = GPIO2, SCL = GPIO3)').blank();
    if (inits.length) w.line('# ---------- Parts ----------').line(inits.join('\n\n')).blank();
    w.line('# ---------- Settings you can change ----------').line('INTERVAL = ' + (prog.interval || 5) + '   # seconds between readings');
    settings.forEach((s) => w.line(s));
    if (boolNames.length) w.line('YES_NO = {' + boolNames.map((n) => '"' + n + '"').join(', ') + '}   # shown as yes/no in messages');
    w.blank().line('# ---------- Helpers ----------').line(PY_HELPERS(boolNames.length > 0)).blank();
    if (helpers.length) w.line(helpers.join('\n\n')).blank();
    w.blank().line('def loop():').in().line(body.text().trimEnd()).out().blank().blank();
    w.line('print("Running. Press Ctrl+C to stop.")')
      .line('try:').in().line('while True:').in().line('loop()').line('time.sleep(INTERVAL)').out().out()
      .line('except KeyboardInterrupt:').in().line('print("Stopped.")').out();
    return { code: w.text(), libs: Array.from(libs), msgUsed };
  };

  function actionCode(A, a, k, t) {
    if (a.uid === 'print') return { label: 'Print', code: 'print(msg)', msg: true };
    if (FM.NET_OUTPUTS.includes(a.uid)) return FM.netAction('python', a, A, t.prog, { imports: t.imports, libs: t.libs, setting: t.ctx.setting, helper: t.ctx.helper });
    if (a.uid === 'log') {
      t.imports.add('import csv'); t.imports.add('import os');
      t.ctx.helper('LOG_FILE = "readings.csv"\n\ndef log_csv(values):\n    new_file = not os.path.exists(LOG_FILE)\n    with open(LOG_FILE, "a", newline="") as f:\n        out = csv.writer(f)\n        if new_file:\n            out.writerow(["time"] + list(values))\n        out.writerow([time.strftime("%Y-%m-%d %H:%M:%S")] + list(values.values()))');
      return { label: 'Save to readings.csv', code: 'log_csv(v)' };
    }
    const i = A.byUid[a.uid];
    if (!i || !i.supported) return null;
    t.use(i);
    const s = PY[i.def.id];
    const f = s && s.acts && s.acts[a.act];
    if (!f) return { label: i.label, code: '# ' + i.label + ': "' + a.act + '" is not available in Python yet' };
    const def = i.def.actions.find((x) => x.k === a.act);
    const always = a.act === 'onwhile' || (a.act === 'angle' && t.hasLimit) || a.act === 'colour';
    return { label: i.label + ': ' + (def ? def.l.toLowerCase() : a.act), code: f(i, a, t.hasLimit), msg: !!(def && def.msg), always };
  }

  function sysHelper(board) {
    return 'def read_board():\n    with open("/sys/class/thermal/thermal_zone0/temp") as f:\n        cpu = round(int(f.read()) / 1000, 1)\n    return {"cpu_temp": cpu, "clock": time.strftime("%H:%M"), "uptime": round(time.monotonic() - START)}';
  }

  function mathExpr(s, x, v) {
    const b = s.bRef ? v + '.get("' + s.bRef + '") or 0' : (s.b == null ? 0 : s.b);
    switch (s.op) {
      case '+': return x + ' + ' + b;
      case '-': return x + ' - ' + b;
      case '*': return x + ' * ' + b;
      case '/': return x + ' / ' + (b || 1);
      case 'abs': return 'abs(' + x + ')';
      case 'round': return 'round(' + x + ', ' + (s.b || 0) + ')';
      case 'map': return '(' + x + ' - ' + (s.b || 0) + ') / (' + (s.b2 == null ? 100 : s.b2) + ' - ' + (s.b || 0) + ') * (' + (s.c2 == null ? 100 : s.c2) + ' - ' + (s.c1 || 0) + ') + ' + (s.c1 || 0);
      default: return x;
    }
  }
  function mathLabel(s) {
    const ops = { '+': 'add', '-': 'subtract', '*': 'multiply', '/': 'divide', abs: 'make positive', round: 'round', map: 'rescale' };
    return s.target + ' = ' + (ops[s.op] || s.op) + ' ' + s.a;
  }
  function limitExpr(l) {
    const x = 'v.get("' + l.key + '")';
    if (l.op === 'yes') return x + ' == 1';
    if (l.op === 'no') return x + ' == 0';
    return x + ' is not None and ' + x + ' ' + (l.op || '>') + ' LIMIT';
  }
  FM.pyMath = { mathExpr, mathLabel, limitExpr };

  const importOrder = (a, b) => (a.startsWith('from') - b.startsWith('from')) || a.localeCompare(b);

  function header(w, A, prog, meta, libs) {
    const pip = Array.from(libs).map((id) => FM.libraries[id]).filter((l) => l && l.kind === 'pip' && !l.preinstalled).map((l) => l.pkg);
    const apt = Array.from(libs).map((id) => FM.libraries[id]).filter((l) => l && l.kind === 'apt' && !l.preinstalled).map((l) => l.pkg);
    w.line('#!/usr/bin/env python3');
    w.line('# ' + (meta.title || 'My project') + ' \u2014 made with friendly-microman for ' + A.board.name);
    w.line('#');
    w.line('# One-time setup on the Pi (in a terminal):');
    A.cmds.forEach((c) => w.line('#   ' + c));
    A.cfg.forEach((c) => w.line('#   echo "' + c + '" | sudo tee -a /boot/firmware/config.txt'));
    if (A.cfg.length) w.line('#   sudo reboot');
    if (apt.length) w.line('#   sudo apt install -y ' + apt.join(' '));
    w.line('#   python3 -m venv --system-site-packages ~/fm-env');
    w.line('#   source ~/fm-env/bin/activate');
    if (pip.length) w.line('#   pip install ' + pip.map((p) => (/[<> ]/.test(p) && !p.includes(' ') ? '"' + p + '"' : p)).join(' '));
    w.line('#');
    w.line('# Run it:  python3 program.py');
    w.blank();
  }

  function PY_HELPERS(yesNo) {
    return [
      'START = time.monotonic()',
      '_last_run = {}',
      '_history = {}',
      '',
      '',
      'class _Blank(dict):',
      '    def __missing__(self, key):',
      '        return "?"',
      '',
      '',
      'def fmt(template, values):',
      '    """Fill {names} in a message with the latest values."""',
      '    clean = {}',
      '    for key, x in values.items():',
      '        if x is None:',
      '            x = "?"',
      yesNo ? '        elif key in YES_NO:\n            x = "yes" if x else "no"' : null,
      '        elif isinstance(x, float):',
      '            x = round(x, 1) if abs(x) < 1000 else round(x)',
      '        clean[key] = x',
      '    return template.format_map(_Blank(clean))',
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
      '    del h[:-n]',
      '    return round(sum(h) / len(h), 1)',
      '',
      '',
      'def ready(name, seconds):',
      '    """True at most once every `seconds`, so alerts do not repeat too often."""',
      '    now = time.monotonic()',
      '    if now - _last_run.get(name, -1e9) >= seconds:',
      '        _last_run[name] = now',
      '        return True',
      '    return False',
    ].filter((l) => l !== null).join('\n');
  }
  FM.PY_HELPERS = PY_HELPERS;
  FM.pyHeader = header;
  FM.pySysHelper = sysHelper;

  // ----- Command listener (voice through a USB mic, or typed) -----
  function listen(A, prog, meta, t) {
    const L = prog.listen || { via: 'typed', rules: [], replies: ['print'] };
    const replies = (L.replies || ['print']);
    const replyLines = [];
    replies.forEach((r) => {
      if (r === 'print') { replyLines.push('print("Pi:", text)'); return; }
      const i = A.byUid[r];
      if (!i || !i.supported) return;
      t.use(i);
      const s = PY[i.def.id];
      if (s && s.acts && s.acts.say) replyLines.push('speak(text)');
      else if (s && s.acts && s.acts.show) replyLines.push('show_' + i.var + '(text)');
    });
    if (!replyLines.length) replyLines.push('print("Pi:", text)');
    const fn = FM.Writer();
    fn.line('def handle(text):').in().line('"""Decide what to do with one command. Return False to stop."""').line('text = text.lower().strip()');
    let first = true;
    (L.rules || []).forEach((r) => {
      const words = String(r.say || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (!words.length) return;
      const test = words.length === 1 ? FM.pyStr(words[0]) + ' in text' : 'any(w in text for w in (' + words.map(FM.pyStr).join(', ') + '))';
      fn.line((first ? 'if ' : 'elif ') + test + ':').in();
      first = false;
      if (r.do === 'time') fn.line('reply(time.strftime("It is %H:%M"))');
      else if (r.do === 'text') fn.line('reply(' + FM.pyStr(r.text || 'Hello!') + ')');
      else if (r.do === 'stop') fn.line('reply("Goodbye")').line('return False');
      else if (r.do === 'reading') {
        if (r.uid === 'sys') { t.helpers.push(sysHelper(A.board)); fn.line('reply(fmt(' + FM.pyStr(r.text || '{value}') + ', {"value": read_board().get("' + r.k + '")}))'); }
        else {
          const i = A.byUid[r.uid];
          if (i && i.supported) { t.use(i); fn.line('reply(fmt(' + FM.pyStr(r.text || '{value}') + ', {"value": read_' + i.var + '().get("' + r.k + '")}))'); }
          else fn.line('reply("That sensor is not connected")');
        }
      } else if (r.do === 'on' || r.do === 'off' || r.do === 'photo') {
        const i = A.byUid[r.uid];
        if (i && i.supported) {
          t.use(i);
          if (r.do === 'photo') fn.line('take_photo()').line('reply("Photo taken")');
          else fn.line(i.var + '.' + r.do + '()').line('reply("' + i.short + ' ' + r.do + '")');
        } else fn.line('reply("That part is not connected")');
      } else fn.line('pass');
      fn.out();
    });
    if (!first) fn.line('else:').in().line('print("(no command matched)")').out();
    fn.line('return True');

    const w = FM.Writer();
    const libs = t.libs;
    if (L.via === 'voice') { libs.add('vosk'); libs.add('portaudio'); t.imports.add('import json'); t.imports.add('import queue'); }
    header(w, A, prog, meta, libs);
    w.line(Array.from(t.imports).sort(importOrder).join('\n')).blank();
    if (t.needI2C()) w.line('i2c = board.I2C()').blank();
    if (t.inits.length) w.line('# ---------- Parts ----------').line(t.inits.join('\n\n')).blank();
    t.settings.forEach((s) => w.line(s));
    w.line('# ---------- Helpers ----------').line(PY_HELPERS(false)).blank();
    if (t.helpers.length) w.line(t.helpers.join('\n\n')).blank();
    w.blank().line('def reply(text):').in().line(replyLines.join('\n')).out().blank().blank();
    w.line(fn.text().trimEnd()).blank().blank();
    if (L.via === 'voice') {
      w.line('def listen_voice():').in()
        .line('from vosk import Model, KaldiRecognizer')
        .line('import sounddevice as sd')
        .line('RATE = 16000  # if you get "Invalid sample rate", try 44100 or 48000')
        .line('model = Model(lang="en-us")  # downloads a small English model the first time')
        .line('recognizer = KaldiRecognizer(model, RATE)')
        .line('audio = queue.Queue()')
        .blank()
        .line('def on_audio(data, frames, when, status):').in().line('audio.put(bytes(data))').out().blank()
        .line('with sd.RawInputStream(samplerate=RATE, blocksize=8000, dtype="int16", channels=1, callback=on_audio):').in()
        .line('reply("I am listening")')
        .line('while True:').in()
        .line('if recognizer.AcceptWaveform(audio.get()):').in()
        .line('text = json.loads(recognizer.Result()).get("text", "")')
        .line('if text:').in().line('print("You said:", text)').line('if not handle(text):').in().line('break').out().out().out().out().out().out()
        .blank().blank()
        .line('try:').in().line('listen_voice()').out().line('except KeyboardInterrupt:').in().line('print("Stopped.")').out();
    } else {
      w.line('print("Type a command and press Enter. Ctrl+C stops.")')
        .line('try:').in().line('while handle(input("You: ")):').in().line('pass').out().out()
        .line('except (KeyboardInterrupt, EOFError):').in().line('print("Stopped.")').out();
    }
    return { code: w.text(), libs: Array.from(libs) };
  }
})();
