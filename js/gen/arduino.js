/* Arduino C++ generator (Uno/Nano, ESP32, ESP8266, Pico with the earlephilhower core). */
(function () {
  const g = (i, idx) => { const id = i.pins[idx]; if (!id) return '?'; const p = i.board.pins[id]; return p.gpio == null || (i.board.family === 'arduino' && id.startsWith('A')) ? id : p.gpio; };
  const gs = (i, name) => g(i, i.def.sig.findIndex((s) => s.p === name));
  const ADDR = (i) => FM.hex(i.addr != null ? i.addr : i.def.addr);
  const cStr = (s) => JSON.stringify(String(s));

  const ANALOG = (key, expr) => ({
    setup: () => '',
    read: (i, c) => 'float level = analogRead(' + g(i, i.def.sig.findIndex((s) => s.k === 'adc')) + ') / ' + c.adcMax + '.0;  // 0.0 to 1.0\n' + i.var + '_' + key + ' = ' + expr + ';',
  });

  const AR = {
    scd40: { libs: ['ard-scd4x'], inc: ['#include "SparkFun_SCD4x_Arduino_Library.h"'], i2c: true,
      decl: (i) => 'SCD4x ' + i.var + ';',
      setup: (i) => 'if (!' + i.var + '.begin()) Serial.println(F("SCD40 not found. Check the wiring."));',
      read: (i) => 'if (' + i.var + '.readMeasurement()) {  // new value every 5 s\n  ' + i.var + '_co2 = ' + i.var + '.getCO2();\n  ' + i.var + '_temperature = ' + i.var + '.getTemperature();\n  ' + i.var + '_humidity = ' + i.var + '.getHumidity();\n}' },
    scd30: { libs: ['ard-scd30'], inc: ['#include "SparkFun_SCD30_Arduino_Library.h"'], i2c: true,
      decl: (i) => 'SCD30 ' + i.var + ';',
      setup: (i) => 'if (!' + i.var + '.begin()) Serial.println(F("SCD30 not found. Check the wiring."));',
      read: (i) => 'if (' + i.var + '.dataAvailable()) {\n  ' + i.var + '_co2 = ' + i.var + '.getCO2();\n  ' + i.var + '_temperature = ' + i.var + '.getTemperature();\n  ' + i.var + '_humidity = ' + i.var + '.getHumidity();\n}' },
    sgp30: { libs: ['ard-sgp30'], inc: ['#include "Adafruit_SGP30.h"'], i2c: true,
      decl: (i) => 'Adafruit_SGP30 ' + i.var + ';',
      setup: (i) => 'if (!' + i.var + '.begin()) Serial.println(F("SGP30 not found."));',
      read: (i) => 'if (' + i.var + '.IAQmeasure()) {\n  ' + i.var + '_eco2 = ' + i.var + '.eCO2;\n  ' + i.var + '_tvoc = ' + i.var + '.TVOC;\n}' },
    mhz19: {
      inc: (i, c) => (c.serialFor(i).soft ? ['#include <SoftwareSerial.h>'] : []),
      decl: (i, c) => { const s = c.serialFor(i); return s.soft ? 'SoftwareSerial ' + i.var + 'Port(' + gs(i, 'TX') + ', ' + gs(i, 'RX') + ');  // (board RX, board TX)' : '#define ' + i.var + 'Port ' + s.name; },
      setup: (i, c) => { const s = c.serialFor(i); return s.begin; },
      read: (i) => 'static const byte ask[9] = {0xFF, 0x01, 0x86, 0, 0, 0, 0, 0, 0x79};\nwhile (' + i.var + 'Port.available()) ' + i.var + 'Port.read();\n' + i.var + 'Port.write(ask, 9);\nbyte r[9];\nif (' + i.var + 'Port.readBytes(r, 9) == 9 && r[0] == 0xFF && r[1] == 0x86) ' + i.var + '_co2 = r[2] * 256 + r[3];' },
    bme280: { libs: ['ard-bme280'], inc: ['#include <Adafruit_BME280.h>'], i2c: true,
      decl: (i) => 'Adafruit_BME280 ' + i.var + ';',
      setup: (i) => 'if (!' + i.var + '.begin(' + ADDR(i) + ')) Serial.println(F("BME280 not found. Try address 0x77."));',
      read: (i) => i.var + '_temperature = ' + i.var + '.readTemperature();\n' + i.var + '_humidity = ' + i.var + '.readHumidity();\n' + i.var + '_pressure = ' + i.var + '.readPressure() / 100.0;' },
    dht22: { libs: ['ard-dht'], inc: ['#include <DHT.h>'],
      decl: (i) => 'DHT ' + i.var + '(' + g(i, 1) + ', DHT22);', setup: (i) => i.var + '.begin();',
      read: (i) => i.var + '_temperature = ' + i.var + '.readTemperature();  // NAN if it missed a reading\n' + i.var + '_humidity = ' + i.var + '.readHumidity();' },
    dht11: { libs: ['ard-dht'], inc: ['#include <DHT.h>'],
      decl: (i) => 'DHT ' + i.var + '(' + g(i, 1) + ', DHT11);', setup: (i) => i.var + '.begin();',
      read: (i) => i.var + '_temperature = ' + i.var + '.readTemperature();\n' + i.var + '_humidity = ' + i.var + '.readHumidity();' },
    ds18b20: { libs: ['ard-onewire', 'ard-dallas'], inc: ['#include <OneWire.h>', '#include <DallasTemperature.h>'],
      decl: (i, c) => c.once('w1', 'OneWire oneWire(' + g(i, 2) + ');\nDallasTemperature probes(&oneWire);'),
      setup: (i, c) => c.once('w1s', 'probes.begin();'),
      read: (i) => 'probes.requestTemperatures();\n' + i.var + '_temperature = probes.getTempCByIndex(' + (i.n - 1) + ');\nif (' + i.var + '_temperature == DEVICE_DISCONNECTED_C) ' + i.var + '_temperature = NAN;' },
    hcsr04: {
      setup: (i) => 'pinMode(' + gs(i, 'Trig') + ', OUTPUT);\npinMode(' + gs(i, 'Echo') + ', INPUT);',
      read: (i) => 'digitalWrite(' + gs(i, 'Trig') + ', LOW); delayMicroseconds(2);\ndigitalWrite(' + gs(i, 'Trig') + ', HIGH); delayMicroseconds(10);\ndigitalWrite(' + gs(i, 'Trig') + ', LOW);\nunsigned long us = pulseIn(' + gs(i, 'Echo') + ', HIGH, 30000);\n' + i.var + '_distance = us ? us / 58.0 : NAN;' },
    pir: { setup: (i) => 'pinMode(' + g(i, 1) + ', INPUT);', read: (i) => i.var + '_motion = digitalRead(' + g(i, 1) + ');' },
    button: { setup: (i) => 'pinMode(' + g(i, 0) + ', INPUT_PULLUP);', read: (i) => i.var + '_pressed = digitalRead(' + g(i, 0) + ') == LOW;  // pressed pulls the pin to GND' },
    mpu6050: { libs: ['ard-mpu6050'], inc: ['#include <Adafruit_MPU6050.h>'], i2c: true,
      decl: (i) => 'Adafruit_MPU6050 ' + i.var + ';',
      setup: (i) => 'if (!' + i.var + '.begin(' + ADDR(i) + ')) Serial.println(F("MPU6050 not found."));',
      read: (i) => 'sensors_event_t a, g, t;\n' + i.var + '.getEvent(&a, &g, &t);\n' + i.var + '_ax = a.acceleration.x; ' + i.var + '_ay = a.acceleration.y; ' + i.var + '_az = a.acceleration.z;\n' + i.var + '_gx = g.gyro.x * 57.2958; ' + i.var + '_gy = g.gyro.y * 57.2958; ' + i.var + '_gz = g.gyro.z * 57.2958;  // rad/s to deg/s\n' + i.var + '_temperature = t.temperature;' },
    bh1750: { libs: ['ard-bh1750'], inc: ['#include <BH1750.h>'], i2c: true,
      decl: (i) => 'BH1750 ' + i.var + '(' + ADDR(i) + ');', setup: (i) => i.var + '.begin();',
      read: (i) => i.var + '_lux = ' + i.var + '.readLightLevel();' },
    mq135: ANALOG('air', 'round(level * 100)'),
    ldr: ANALOG('light', 'round(level * 100)'),
    pot: ANALOG('knob', 'round(level * 100)'),
    soil: Object.assign(ANALOG('moisture', 'constrain(round((SOIL_DRY - level) / (SOIL_DRY - SOIL_WET) * 100), 0, 100)'), {
      decl: (i, c) => c.once('soil', 'const float SOIL_DRY = 0.80;  // probe level in dry air (0-1, measure yours)\nconst float SOIL_WET = 0.35;  // probe level in water'),
    }),
    oled: { libs: ['ard-ssd1306', 'ard-gfx'], inc: ['#include <Adafruit_GFX.h>', '#include <Adafruit_SSD1306.h>'], i2c: true,
      decl: (i) => 'Adafruit_SSD1306 ' + i.var + '(128, 64, &Wire, -1);',
      setup: (i) => 'if (!' + i.var + '.begin(SSD1306_SWITCHCAPVCC, ' + ADDR(i) + ')) Serial.println(F("OLED not found."));\n' + i.var + '.setTextColor(SSD1306_WHITE);',
      acts: { show: (i) => i.var + '.clearDisplay();\n' + i.var + '.setCursor(0, 0);\n' + i.var + '.print(msg);\n' + i.var + '.display();' } },
    lcd1602: { libs: ['ard-lcd-i2c'], inc: ['#include <LiquidCrystal_I2C.h>'], i2c: true,
      decl: (i) => 'LiquidCrystal_I2C ' + i.var + '(' + ADDR(i) + ', 16, 2);',
      setup: (i) => i.var + '.init();\n' + i.var + '.backlight();',
      acts: { show: (i) => i.var + '.clear();\n' + i.var + '.print(msg.substring(0, 16));\n' + i.var + '.setCursor(0, 1);\n' + i.var + '.print(msg.substring(16, 32));' } },
    tm1637: { libs: ['ard-tm1637'], inc: ['#include <TM1637Display.h>'],
      decl: (i) => 'TM1637Display ' + i.var + '(' + gs(i, 'CLK') + ', ' + gs(i, 'DIO') + ');', setup: (i) => i.var + '.setBrightness(5);',
      acts: { number: (i, a) => 'if (!isnan(v_' + a.key + ')) ' + i.var + '.showNumberDec((int)v_' + a.key + ');' } },
    led: { setup: (i) => 'pinMode(' + g(i, 0) + ', OUTPUT);',
      acts: { onwhile: (i) => 'digitalWrite(' + g(i, 0) + ', alert ? HIGH : LOW);', blink: (i, a) => 'for (int k = 0; k < ' + (a.n || 3) + '; k++) { digitalWrite(' + g(i, 0) + ', HIGH); delay(200); digitalWrite(' + g(i, 0) + ', LOW); delay(200); }' } },
    rgbled: { setup: (i) => ['Red leg', 'Green leg', 'Blue leg'].map((n) => 'pinMode(' + gs(i, n) + ', OUTPUT);').join('\n'),
      acts: { colour: (i, a) => { const c1 = FM.hexColour(a.colour), c2 = FM.hexColour(a.colour2 || '#000000'); return ['Red leg', 'Green leg', 'Blue leg'].map((n, k) => 'analogWrite(' + gs(i, n) + ', alert ? ' + c1[k] + ' : ' + c2[k] + ');').join('\n'); } } },
    buzzer: { setup: (i) => 'pinMode(' + g(i, 0) + ', OUTPUT);',
      acts: { beep: (i, a) => 'for (int k = 0; k < ' + (a.n || 3) + '; k++) { digitalWrite(' + g(i, 0) + ', HIGH); delay(100); digitalWrite(' + g(i, 0) + ', LOW); delay(100); }' } },
    servo: { libs: (c) => [c.board.family === 'esp32' ? 'ard-esp32servo' : 'ard-servo'], inc: (i, c) => [c.board.family === 'esp32' ? '#include <ESP32Servo.h>' : '#include <Servo.h>'],
      decl: (i) => 'Servo ' + i.var + ';', setup: (i) => i.var + '.attach(' + g(i, 2) + ');',
      acts: {
        angle: (i, a, lim) => i.var + '.write(' + (lim ? 'alert ? ' + (a.angle || 0) + ' : ' + (a.angle2 || 0) : (a.angle || 0)) + ');',
        follow: (i, a) => 'if (!isnan(v_' + a.key + ')) ' + i.var + '.write(constrain((v_' + a.key + ' - ' + (a.min || 0) + ') / (' + (a.max || 100) + ' - ' + (a.min || 0) + ') * 180, 0, 180));',
      } },
    relay: { setup: (i) => 'pinMode(' + g(i, 2) + ', OUTPUT);\ndigitalWrite(' + g(i, 2) + ', HIGH);  // most relay modules switch on when LOW',
      acts: { onwhile: (i) => 'digitalWrite(' + g(i, 2) + ', alert ? LOW : HIGH);' } },
    ws2812: { libs: ['ard-neopixel'], inc: ['#include <Adafruit_NeoPixel.h>'],
      decl: (i) => '#define LED_COUNT 8  // how many LEDs are on your strip\nAdafruit_NeoPixel ' + i.var + '(LED_COUNT, ' + g(i, 2) + ', NEO_GRB + NEO_KHZ800);',
      setup: (i) => i.var + '.begin();\n' + i.var + '.setBrightness(80);',
      acts: { colour: (i, a) => { const c1 = FM.hexColour(a.colour), c2 = FM.hexColour(a.colour2 || '#000000'); return i.var + '.fill(alert ? ' + i.var + '.Color(' + c1.join(', ') + ') : ' + i.var + '.Color(' + c2.join(', ') + '));\n' + i.var + '.show();'; } } },
    stepper: { inc: ['#include <Stepper.h>'],
      decl: (i) => 'Stepper ' + i.var + '(2048, ' + [0, 2, 1, 3].map((k) => g(i, k)).join(', ') + ');  // IN1, IN3, IN2, IN4 order is needed for this motor',
      setup: (i) => i.var + '.setSpeed(10);  // rpm',
      acts: { turn: (i, a) => i.var + '.step(' + (a.steps || 512) + ');  // 2048 steps = one full turn' } },
  };
  FM.AR_PARTS = AR;

  FM.gen.arduino = function (A, prog, meta) {
    const board = A.board;
    const incs = [], decls = [], setups = [], reads = [], globals = [];
    const libs = new Set();
    const done = {}, onceKeys = {};
    let needI2C = false, serialIdx = 0;
    const ctx = {
      board, adcMax: board.family === 'esp32' ? 4095 : 1023,
      once(key, code) { if (onceKeys[key]) return ''; onceKeys[key] = true; return code; },
      serialFor(i) {
        if (i._serial) return i._serial;
        const u = i.uart || {};
        let s;
        if (u.soft || board.family === 'arduino' || board.family === 'esp8266') s = { soft: true, begin: i.var + 'Port.begin(9600);' };
        else if (board.family === 'esp32') { const n = u.id === 1 ? 'Serial1' : 'Serial2'; s = { name: n, begin: n + '.begin(9600, SERIAL_8N1, ' + gs(i, 'TX') + ', ' + gs(i, 'RX') + ');  // (RX pin, TX pin)' }; }
        else { const n = 'Serial' + (2 - serialIdx++); s = { name: n, begin: n + '.setRX(' + gs(i, 'TX') + ');\n' + n + '.setTX(' + gs(i, 'RX') + ');\n' + n + '.begin(9600);' }; }
        i._serial = s;
        return s;
      },
    };
    const add = (arr, s) => { if (s && !arr.includes(s)) arr.push(s); };
    function use(i) {
      if (!i || done[i.uid]) return i;
      done[i.uid] = true;
      i.board = board;
      const s = AR[i.def.id];
      if (!s) { add(decls, '// ' + i.label + ': no Arduino code for this part yet'); return i; }
      (typeof s.libs === 'function' ? s.libs(ctx) : s.libs || []).forEach((l) => libs.add(l));
      (typeof s.inc === 'function' ? s.inc(i, ctx) : s.inc || []).forEach((x) => add(incs, x));
      if (s.i2c) needI2C = true;
      if (s.decl) add(decls, s.decl(i, ctx));
      if (s.setup) add(setups, s.setup(i, ctx) ? '// ' + i.label + '\n' + s.setup(i, ctx) : '');
      if (s.read) {
        i.def.values.forEach((v) => globals.push('float ' + i.var + '_' + v.k + ' = NAN;'));
        reads.push('void read_' + i.var + '() {\n' + FM.indent(s.read(i, ctx), 1).replace(/^    /gm, '  ') + '\n}');
      }
      return i;
    }

    const names = FM.programNames(A, prog);
    const limit = (prog.steps || []).find((s) => s.t === 'limit');
    const loop = [];
    let sysUsed = false;
    const readers = {};
    (prog.reads || []).forEach((r) => { if (r.uid === 'sys') readers.sys = 1; else { const i = A.byUid[r.uid]; if (i && i.supported) { use(i); readers[i.uid] = i; } } });

    const valueDecls = names.map((n) => 'float v_' + n.name + ' = NAN;' + (n.unit ? '  // ' + n.unit : ''));
    const boolSet = new Set(names.filter((n) => n.bool).map((n) => n.name));
    const tplToC = (tpl) => {
      const parts = FM.parseTemplate(tpl).map((p) => (p.text != null ? cStr(p.text) : names.some((n) => n.name === p.name) ? (boolSet.has(p.name) ? 'yesNo(v_' + p.name + ')' : 'fv(v_' + p.name + ')') : cStr('?')));
      return parts.length ? 'String(' + parts[0] + ')' + parts.slice(1).map((p) => ' + ' + p).join('') : 'String("")';
    };

    if (prog.mode === 'listen') return listen(A, prog, meta, { use, incs, decls, setups, reads, globals, libs, needI2C: () => needI2C });

    Object.entries(readers).forEach(([uid, i]) => {
      if (uid === 'sys') { sysUsed = true; prog.reads.filter((r) => r.uid === 'sys').forEach((r) => loop.push('v_' + r.name + ' = millis() / 1000;')); return; }
      loop.push('read_' + i.var + '();');
      prog.reads.filter((r) => r.uid === uid).forEach((r) => loop.push('v_' + r.name + ' = ' + i.var + '_' + r.k + ';'));
    });
    (prog.steps || []).forEach((s) => {
      if (s.t === 'math') loop.push('v_' + s.target + ' = ' + cMath(s) + ';  // ' + FM.pyMath.mathLabel(s));
      if (s.t === 'smooth') loop.push('v_' + s.key + ' = smooth(v_' + s.key + ', ' + (s.n || 5) + ', hist_' + s.key + ', &count_' + s.key + ');');
      if (s.t === 'convert') loop.push('v_' + s.key + ' = v_' + s.key + ' * 9.0 / 5.0 + 32;  // \u00b0C to \u00b0F');
    });
    const smooths = (prog.steps || []).filter((s) => s.t === 'smooth');
    if (limit) loop.push('bool alert = ' + cLimit(limit) + ';  // the check');
    else loop.push('bool alert = true;  // no check added');

    (prog.actions || []).forEach((a) => {
      const tpl = a.msg || prog.message || FM.defaultMessage(A, prog);
      let label, code, msg = false, always = false;
      if (a.uid === 'print') { label = 'Print to the Serial Monitor'; code = 'Serial.println(msg);'; msg = true; }
      else if (a.uid === 'log') return;
      else {
        const i = A.byUid[a.uid];
        if (!i || !i.supported) return;
        use(i);
        const s = AR[i.def.id];
        const f = s && s.acts && s.acts[a.act];
        const def = i.def.actions.find((x) => x.k === a.act);
        label = i.label + ': ' + (def ? def.l.toLowerCase() : a.act);
        code = f ? f(i, a, !!limit) : '// not available for Arduino yet';
        msg = !!(def && def.msg);
        always = a.act === 'onwhile' || (a.act === 'angle' && !!limit) || a.act === 'colour';
      }
      const cond = [];
      if (a.when === 'alert') cond.push('alert');
      if (a.when === 'calm') cond.push('!alert');
      if (a.every > 0) cond.push('ready(' + JSON.stringify(a.id) + ', ' + a.every + ')');
      const full = (msg ? 'String msg = ' + tplToC(tpl) + ';\n' : '') + code;
      loop.push('');
      loop.push('// ' + label + ', ' + FM.whenText(a));
      if (cond.length && !always) loop.push('if (' + cond.join(' && ') + ') {\n' + FM.indent(full, 1).replace(/^    /gm, '  ') + '\n}');
      else loop.push(msg ? '{\n' + FM.indent(full, 1).replace(/^    /gm, '  ') + '\n}' : full);
    });

    const out = [];
    const ard = Array.from(libs).map((id) => FM.libraries[id]).filter((l) => l && l.kind === 'arduino');
    out.push('// ' + (meta.title || 'My project') + ' \u2014 made with friendly-microman for ' + board.name);
    if (ard.length) { out.push('//'); out.push('// Libraries (Library Manager, or: arduino-cli lib install "<name>"):'); ard.forEach((l) => out.push('//   ' + l.pkg)); }
    out.push('');
    if (needI2C) incs.unshift('#include <Wire.h>');
    out.push(incs.join('\n'));
    out.push('');
    out.push('const unsigned long INTERVAL_MS = ' + Math.round((prog.interval || 5) * 1000) + ';  // time between readings');
    if (limit) out.push('const float LIMIT = ' + (limit.val == null ? 0 : limit.val) + ';');
    out.push('');
    if (decls.length) out.push('// ---------- Parts ----------\n' + decls.filter(Boolean).join('\n') + '\n');
    out.push('// ---------- Values ----------');
    out.push(globals.concat(valueDecls).join('\n'));
    smooths.forEach((s) => out.push('float hist_' + s.key + '[' + (s.n || 5) + ']; int count_' + s.key + ' = 0;'));
    out.push('');
    out.push(AR_HELPERS(smooths.length > 0, (prog.actions || []).some((a) => a.every > 0)));
    out.push('');
    if (reads.length) out.push(reads.join('\n\n') + '\n');
    out.push('void setup() {\n  Serial.begin(115200);\n' + (needI2C ? '  Wire.begin();\n' : '') + setups.filter(Boolean).map((s) => FM.indent(s, 1).replace(/^    /gm, '  ')).join('\n') + '\n  Serial.println(F("Running."));\n}');
    out.push('');
    out.push('void loop() {\n' + loop.map((l) => (l ? FM.indent(l, 1).replace(/^    /gm, '  ') : '')).join('\n') + '\n\n  delay(INTERVAL_MS);\n}');
    return { code: out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n', libs: Array.from(libs) };
  };

  function cMath(s) {
    const x = 'v_' + s.a, b = s.b == null ? 0 : s.b;
    switch (s.op) {
      case '+': return x + ' + ' + b;
      case '-': return x + ' - ' + b;
      case '*': return x + ' * ' + b;
      case '/': return x + ' / ' + (b || 1);
      case 'abs': return 'fabs(' + x + ')';
      case 'round': { const m = Math.pow(10, s.b || 0); return 'round(' + x + ' * ' + m + ') / ' + m + '.0'; }
      case 'map': return '(' + x + ' - ' + (s.b || 0) + ') / (' + (s.b2 == null ? 100 : s.b2) + ' - ' + (s.b || 0) + ') * (' + (s.c2 == null ? 100 : s.c2) + ' - ' + (s.c1 || 0) + ') + ' + (s.c1 || 0);
      default: return x;
    }
  }
  function cLimit(l) {
    const x = 'v_' + l.key;
    if (l.op === 'yes') return x + ' == 1';
    if (l.op === 'no') return x + ' == 0';
    return '!isnan(' + x + ') && ' + x + ' ' + (l.op === '==' ? '==' : l.op || '>') + ' LIMIT';
  }

  function AR_HELPERS(smooth, ready) {
    const h = [
      '// ---------- Helpers ----------',
      'String fv(float x) {  // number to text, "?" when there is no reading',
      '  if (isnan(x)) return "?";',
      '  if (x == (long)x) return String((long)x);',
      '  return String(x, 1);',
      '}',
      '',
      'String yesNo(float x) { return isnan(x) ? "?" : (x ? "yes" : "no"); }',
    ];
    if (smooth) h.push('', 'float smooth(float x, int n, float *hist, int *count) {', '  if (isnan(x)) return NAN;', '  hist[*count % n] = x;', '  (*count)++;', '  int k = min(*count, n);', '  float sum = 0;', '  for (int i = 0; i < k; i++) sum += hist[i];', '  return sum / k;', '}');
    if (ready) h.push('', 'bool ready(const char *name, unsigned long seconds) {  // at most once every `seconds`', '  static const char *names[8]; static unsigned long last[8]; static int used = 0;', '  int i = 0;', '  while (i < used && strcmp(names[i], name) != 0) i++;', '  if (i == used) {', '    if (used == 8) return true;', '    names[used++] = name;', '    last[i] = millis();', '    return true;', '  }', '  if (millis() - last[i] >= seconds * 1000UL) { last[i] = millis(); return true; }', '  return false;', '}');
    return h.join('\n');
  }

  function listen(A, prog, meta, t) {
    const L = prog.listen || { rules: [] };
    const board = A.board;
    const replies = [];
    (L.replies || ['print']).forEach((r) => {
      if (r === 'print') replies.push('Serial.println(text);');
      else { const i = A.byUid[r]; if (i && i.supported && AR[i.def.id] && AR[i.def.id].acts && AR[i.def.id].acts.show) { t.use(i); replies.push('{ String msg = text;\n' + FM.indent(AR[i.def.id].acts.show(i), 1).replace(/^    /gm, '  ') + ' }'); } }
    });
    if (!replies.length) replies.push('Serial.println(text);');
    const h = ['void reply(String text) {', FM.indent(replies.join('\n'), 1).replace(/^    /gm, '  '), '}', '', 'void handle(String text) {', '  text.toLowerCase();', '  text.trim();'];
    let first = true;
    (L.rules || []).forEach((r) => {
      const words = String(r.say || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (!words.length) return;
      h.push('  ' + (first ? 'if' : '} else if') + ' (' + words.map((x) => 'text.indexOf(' + cStr(x) + ') >= 0').join(' || ') + ') {');
      first = false;
      if (r.do === 'time') h.push('    reply("Running for " + String(millis() / 1000) + " seconds");');
      else if (r.do === 'text') h.push('    reply(' + cStr(r.text || 'Hello!') + ');');
      else if (r.do === 'reading') {
        const i = A.byUid[r.uid];
        if (r.uid === 'sys') h.push('    reply(String(millis() / 1000));');
        else if (i && i.supported) {
          t.use(i);
          const parts = FM.parseTemplate(r.text || '{value}').map((p) => (p.text != null ? cStr(p.text) : p.name === 'value' ? 'fv(' + i.var + '_' + r.k + ')' : '"?"'));
          h.push('    read_' + i.var + '();', '    reply(String(' + parts.join(') + String(') + '));');
        } else h.push('    reply("That sensor is not connected");');
      } else if (r.do === 'on' || r.do === 'off') {
        const i = A.byUid[r.uid];
        if (i && i.supported) { t.use(i); const pin = g(i, i.def.id === 'relay' ? 2 : 0); const on = r.do === 'on'; const level = i.def.id === 'relay' ? (on ? 'LOW' : 'HIGH') : (on ? 'HIGH' : 'LOW'); h.push('    digitalWrite(' + pin + ', ' + level + ');', '    reply("' + i.short + ' ' + r.do + '");'); }
        else h.push('    reply("That part is not connected");');
      } else if (r.do === 'stop') h.push('    reply("Stopping. Press reset to start again.");', '    while (true) delay(1000);');
    });
    if (!first) h.push('  } else {', '    reply("Sorry, I do not know that command");', '  }');
    h.push('}');
    const out = [];
    out.push('// ' + (meta.title || 'Command listener') + ' \u2014 made with friendly-microman for ' + board.name);
    out.push('// Open the Serial Monitor at 115200 baud, type a command and press Enter.');
    out.push('');
    if (t.needI2C()) t.incs.unshift('#include <Wire.h>');
    out.push(t.incs.join('\n'), '');
    if (t.decls.length) out.push(t.decls.filter(Boolean).join('\n'), '');
    if (t.globals.length) out.push(t.globals.join('\n'), '');
    out.push(AR_HELPERS(false, false), '');
    if (t.reads.length) out.push(t.reads.join('\n\n'), '');
    out.push(h.join('\n'), '');
    out.push('void setup() {\n  Serial.begin(115200);\n' + (t.needI2C() ? '  Wire.begin();\n' : '') + t.setups.filter(Boolean).map((s) => FM.indent(s, 1).replace(/^    /gm, '  ')).join('\n') + '\n  Serial.println(F("Type a command and press Enter."));\n}', '');
    out.push('void loop() {\n  if (Serial.available()) handle(Serial.readStringUntil(\'\\n\'));\n}');
    return { code: out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n', libs: Array.from(t.libs) };
  }
})();
