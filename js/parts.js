/* Parts catalog. Each part says how it connects (sig), what you can read from it
   (values, the "channels"), what you can make it do (actions), and which libraries
   back it on each language. Code snippets live in js/gen/<language>.js under the same id.

   Signal kinds: vcc (board logic voltage), v3, v5, gnd, sda, scl, mosi, miso, sck, cs,
   tx (part transmits -> board RX), rx (part receives <- board TX), w1, pwm, gpio, adc,
   i2s_bclk, i2s_ws, i2s_din, ws (addressable LED data). A part with `port` plugs into a socket. */
(function () {
  const P = FM.registerPart;
  const PI = ['pi'];

  // ---------- Air quality and CO2 ----------
  P({ id: 'scd40', name: 'SCD40 CO₂ sensor', cat: 'air', iface: 'I2C', power: 'v3', ma: 20, addr: 0x62,
    desc: 'Measures real CO₂ (400–2000 ppm) plus temperature and humidity. The best pick for room air.',
    sig: [{ p: 'VIN', k: 'v3' }, { p: 'GND', k: 'gnd' }, { p: 'SDA', k: 'sda' }, { p: 'SCL', k: 'scl' }],
    values: [{ k: 'co2', l: 'CO₂', u: 'ppm' }, { k: 'temperature', l: 'Temperature', u: '°C' }, { k: 'humidity', l: 'Humidity', u: '%' }],
    notes: ['A new reading is ready every 5 seconds.', 'Above 1000 ppm a room feels stuffy; open a window.'],
    libs: { python: ['blinka', 'py-scd4x'], micropython: [], arduino: ['ard-scd4x'] },
    icon: { pcb: '#3d3d3f', kind: 'chip', chip: '#c9c9c9' } });

  P({ id: 'scd30', name: 'SCD30 CO₂ sensor', cat: 'air', iface: 'I2C', power: 'v3', ma: 19, addr: 0x61,
    desc: 'Accurate NDIR CO₂ sensor with temperature and humidity. Bigger and older than the SCD40.',
    sig: [{ p: 'VIN', k: 'v3' }, { p: 'GND', k: 'gnd' }, { p: 'SDA', k: 'sda' }, { p: 'SCL', k: 'scl' }],
    values: [{ k: 'co2', l: 'CO₂', u: 'ppm' }, { k: 'temperature', l: 'Temperature', u: '°C' }, { k: 'humidity', l: 'Humidity', u: '%' }],
    notes: ['It needs a slow I2C bus. On a Pi add "dtparam=i2c_arm_baudrate=50000" to config.txt.'],
    libs: { python: ['blinka', 'py-scd30'], arduino: ['ard-scd30'] }, families: ['pi', 'arduino', 'esp32'],
    icon: { pcb: '#2b6b3a', kind: 'chip', chip: '#d9d9d9' } });

  P({ id: 'mhz19', name: 'MH-Z19B CO₂ sensor', cat: 'air', iface: 'UART', power: 'v5', ma: 60,
    desc: 'Popular low-cost NDIR CO₂ sensor that talks over serial. Needs 5 V power, but its signals are 3.3 V.',
    sig: [{ p: 'Vin', k: 'v5' }, { p: 'GND', k: 'gnd' }, { p: 'TX', k: 'tx' }, { p: 'RX', k: 'rx' }],
    values: [{ k: 'co2', l: 'CO₂', u: 'ppm' }],
    notes: ['Give it 3 minutes to warm up after power on.'],
    libs: { python: ['pyserial'], arduino: [] },
    icon: { pcb: '#c9a227', kind: 'grid' } });

  P({ id: 'sgp30', name: 'SGP30 air quality', cat: 'air', iface: 'I2C', power: 'v3', ma: 48, addr: 0x58,
    desc: 'Estimates CO₂ (eCO₂) and volatile gases (TVOC). It guesses CO₂ from gases, so it is less exact than an NDIR sensor.',
    sig: [{ p: 'VIN', k: 'v3' }, { p: 'GND', k: 'gnd' }, { p: 'SDA', k: 'sda' }, { p: 'SCL', k: 'scl' }],
    values: [{ k: 'eco2', l: 'eCO₂', u: 'ppm' }, { k: 'tvoc', l: 'TVOC', u: 'ppb' }],
    notes: ['Readings settle after about 15 seconds; best after 12 hours of running.'],
    libs: { python: ['blinka', 'py-sgp30'], arduino: ['ard-sgp30'] }, families: ['pi', 'arduino', 'esp32'],
    icon: { pcb: '#1f3f8f', kind: 'chip', chip: '#bbb' } });

  P({ id: 'mq135', name: 'MQ-135 gas sensor', cat: 'air', iface: 'Analog', power: 'v5', ma: 150,
    desc: 'Cheap air quality sensor with a heater. Gives a relative "how dirty is the air" level, not exact ppm.',
    sig: [{ p: 'VCC', k: 'v5' }, { p: 'GND', k: 'gnd' }, { p: 'AO', k: 'adc', out5v: true }],
    values: [{ k: 'air', l: 'Air quality level', u: '%' }],
    notes: ['Let the heater run 24 hours before trusting it.', 'On 3.3 V boards put a voltage divider (10 kΩ + 20 kΩ) on AO.'],
    icon: { pcb: '#2457a6', kind: 'dome', dome: '#9aa3ad' } });

  // ---------- Temperature and climate ----------
  P({ id: 'bme280', name: 'BME280 weather sensor', cat: 'climate', iface: 'I2C', power: 'v3', ma: 1, addr: 0x76, alts: [0x77],
    desc: 'Temperature, humidity and air pressure in one tiny chip. Great for a weather station.',
    sig: [{ p: 'VIN', k: 'v3' }, { p: 'GND', k: 'gnd' }, { p: 'SDA', k: 'sda' }, { p: 'SCL', k: 'scl' }],
    values: [{ k: 'temperature', l: 'Temperature', u: '°C' }, { k: 'humidity', l: 'Humidity', u: '%' }, { k: 'pressure', l: 'Pressure', u: 'hPa' }],
    notes: ['Some boards use address 0x77 instead of 0x76; tie SDO to 3V3 to pick 0x77.'],
    libs: { python: ['blinka', 'py-bme280'], arduino: ['ard-bme280'] },
    icon: { pcb: '#6a2c91', kind: 'chip', chip: '#d0d0d0', small: true } });

  P({ id: 'dht22', name: 'DHT22 temp & humidity', cat: 'climate', iface: 'GPIO', power: 'vcc', ma: 2,
    desc: 'Classic white temperature and humidity sensor. Read it at most every 2 seconds.',
    sig: [{ p: '+', k: 'vcc' }, { p: 'OUT', k: 'gpio' }, { p: '−', k: 'gnd' }],
    values: [{ k: 'temperature', l: 'Temperature', u: '°C' }, { k: 'humidity', l: 'Humidity', u: '%' }],
    notes: ['Bare sensors (4 legs) need a 10 kΩ resistor from OUT to +. Modules already have it.'],
    libs: { python: ['blinka', 'py-dht'], arduino: ['ard-dht'] },
    icon: { pcb: '#e9e9e4', kind: 'grid', grid: '#bdbdb5' } });

  P({ id: 'dht11', name: 'DHT11 temp & humidity', cat: 'climate', iface: 'GPIO', power: 'vcc', ma: 2,
    desc: 'Cheaper blue cousin of the DHT22. Whole degrees only, 20–90 % humidity.',
    sig: [{ p: '+', k: 'vcc' }, { p: 'OUT', k: 'gpio' }, { p: '−', k: 'gnd' }],
    values: [{ k: 'temperature', l: 'Temperature', u: '°C' }, { k: 'humidity', l: 'Humidity', u: '%' }],
    notes: ['Same wiring as the DHT22.'],
    libs: { python: ['blinka', 'py-dht'], arduino: ['ard-dht'] },
    icon: { pcb: '#2f7fd1', kind: 'grid', grid: '#1e5fa6' } });

  P({ id: 'ds18b20', name: 'DS18B20 waterproof temp', cat: 'climate', iface: '1-Wire', power: 'v3', ma: 2,
    desc: 'Temperature probe on a cable. Works in water or soil, and many probes can share one pin.',
    sig: [{ p: 'Red (VDD)', k: 'v3' }, { p: 'Black (GND)', k: 'gnd' }, { p: 'Yellow (DATA)', k: 'w1' }],
    values: [{ k: 'temperature', l: 'Temperature', u: '°C' }],
    extra: ['4.7 kΩ resistor between DATA and 3V3'],
    notes: ['Add one 4.7 kΩ resistor between DATA and 3V3, even with several probes.'],
    libs: { arduino: ['ard-onewire', 'ard-dallas'] },
    icon: { pcb: '#222', kind: 'probe' } });

  // ---------- Motion, distance, position ----------
  P({ id: 'hcsr04', name: 'HC-SR04 distance sensor', cat: 'motion', iface: 'GPIO', power: 'v5', ma: 15,
    desc: 'Measures distance with sound pulses, 2–400 cm. The "two eyes" sensor.',
    sig: [{ p: 'VCC', k: 'v5' }, { p: 'Trig', k: 'gpio', dir: 'out' }, { p: 'Echo', k: 'gpio', dir: 'in', out5v: true }, { p: 'GND', k: 'gnd' }],
    values: [{ k: 'distance', l: 'Distance', u: 'cm' }],
    notes: ['Echo is 5 V. On 3.3 V boards use a divider: Echo → 1 kΩ → pin, and 2 kΩ from pin to GND.'],
    icon: { pcb: '#1d4f9a', kind: 'eyes' } });

  P({ id: 'pir', name: 'PIR motion sensor (HC-SR501)', cat: 'motion', iface: 'GPIO', power: 'v5', ma: 1,
    desc: 'Notices people moving up to about 7 m away. Output is 3.3 V, so it is safe on any board.',
    sig: [{ p: 'VCC', k: 'v5' }, { p: 'OUT', k: 'gpio', dir: 'in' }, { p: 'GND', k: 'gnd' }],
    values: [{ k: 'motion', l: 'Motion seen', u: 'yes/no', bool: true }],
    notes: ['The two orange knobs set sensitivity and how long it stays on.', 'Wait a minute after power on before testing.'],
    icon: { pcb: '#2e7d32', kind: 'dome', dome: '#f2f2ee' } });

  P({ id: 'mpu6050', name: 'MPU6050 gyro + accelerometer', cat: 'motion', iface: 'I2C', power: 'v3', ma: 4, addr: 0x68, alts: [0x69],
    desc: 'Senses tilt and turning on three axes (x, y, z). Use it for balance bots, game controllers or shake alarms.',
    sig: [{ p: 'VCC', k: 'v3' }, { p: 'GND', k: 'gnd' }, { p: 'SCL', k: 'scl' }, { p: 'SDA', k: 'sda' }],
    values: [
      { k: 'ax', l: 'Acceleration x', u: 'm/s²' }, { k: 'ay', l: 'Acceleration y', u: 'm/s²' }, { k: 'az', l: 'Acceleration z', u: 'm/s²' },
      { k: 'gx', l: 'Rotation x', u: '°/s' }, { k: 'gy', l: 'Rotation y', u: '°/s' }, { k: 'gz', l: 'Rotation z', u: '°/s' },
      { k: 'temperature', l: 'Chip temperature', u: '°C' }],
    notes: ['Flat on a table, z reads about 9.8 m/s² (gravity) and x, y read about 0.'],
    libs: { python: ['blinka', 'py-mpu6050'], arduino: ['ard-mpu6050'] },
    icon: { pcb: '#1d4f9a', kind: 'chip', chip: '#222', small: true } });

  // ---------- Light and analog ----------
  P({ id: 'bh1750', name: 'BH1750 light meter', cat: 'light', iface: 'I2C', power: 'v3', ma: 1, addr: 0x23, alts: [0x5c],
    desc: 'Measures brightness in lux, like a camera light meter.',
    sig: [{ p: 'VCC', k: 'v3' }, { p: 'GND', k: 'gnd' }, { p: 'SCL', k: 'scl' }, { p: 'SDA', k: 'sda' }],
    values: [{ k: 'lux', l: 'Light', u: 'lux' }],
    libs: { python: ['blinka', 'py-bh1750'], arduino: ['ard-bh1750'] },
    icon: { pcb: '#1d4f9a', kind: 'chip', chip: '#e0e0e0', small: true } });

  P({ id: 'ldr', name: 'Light sensor (LDR)', cat: 'light', iface: 'Analog', power: 'vcc', ma: 1,
    desc: 'A photoresistor: its resistance drops in bright light. Simple way to tell day from night.',
    sig: [{ p: 'Leg 1', k: 'vcc' }, { p: 'Leg 2', k: 'adc' }, { p: '10 kΩ resistor (other end)', k: 'gnd' }],
    values: [{ k: 'light', l: 'Light level', u: '%' }],
    extra: ['10 kΩ resistor from Leg 2 to GND'],
    notes: ['Leg 2 also connects to one end of a 10 kΩ resistor; the other end goes to GND.'],
    icon: { pcb: 'none', kind: 'ldr' } });

  P({ id: 'soil', name: 'Soil moisture (capacitive)', cat: 'light', iface: 'Analog', power: 'v3', ma: 5,
    desc: 'Push it into a plant pot to know when to water. The capacitive type does not rust.',
    sig: [{ p: 'VCC', k: 'v3' }, { p: 'GND', k: 'gnd' }, { p: 'AOUT', k: 'adc' }],
    values: [{ k: 'moisture', l: 'Soil moisture', u: '%' }],
    notes: ['Measure it in dry air and in a glass of water, then put those numbers in the code to calibrate.'],
    icon: { pcb: '#1a1a1a', kind: 'fork' } });

  P({ id: 'pot', name: 'Potentiometer (knob)', cat: 'input', iface: 'Analog', power: 'vcc', ma: 1,
    desc: 'A turning knob. Read it as 0–100 % to set volume, speed or a servo angle.',
    sig: [{ p: 'Left leg', k: 'vcc' }, { p: 'Middle leg', k: 'adc' }, { p: 'Right leg', k: 'gnd' }],
    values: [{ k: 'knob', l: 'Knob position', u: '%' }],
    icon: { pcb: 'none', kind: 'knob' } });

  P({ id: 'button', name: 'Push button', cat: 'input', iface: 'GPIO', power: null, ma: 0,
    desc: 'The simplest input. The program uses the board’s built-in pull-up, so no resistor is needed.',
    sig: [{ p: 'Leg 1', k: 'gpio', dir: 'in', pullup: true }, { p: 'Leg 2', k: 'gnd' }],
    values: [{ k: 'pressed', l: 'Pressed', u: 'yes/no', bool: true }],
    icon: { pcb: 'none', kind: 'button' } });

  // ---------- Displays ----------
  P({ id: 'oled', name: 'OLED 0.96" (SSD1306)', cat: 'display', iface: 'I2C', power: 'v3', ma: 20, addr: 0x3c, alts: [0x3d],
    desc: 'Small sharp 128×64 screen. Shows about 6 lines of text.',
    sig: [{ p: 'VCC', k: 'v3' }, { p: 'GND', k: 'gnd' }, { p: 'SCL', k: 'scl' }, { p: 'SDA', k: 'sda' }],
    actions: [{ k: 'show', l: 'Show text', msg: true }],
    libs: { python: ['blinka', 'py-ssd1306', 'pillow'], micropython: ['mip-ssd1306'], arduino: ['ard-ssd1306', 'ard-gfx'] },
    icon: { pcb: '#1d4f9a', kind: 'screen' } });

  P({ id: 'lcd1602', name: 'LCD 16×2 with I2C backpack', cat: 'display', iface: 'I2C', power: 'v5', ma: 30, addr: 0x27, alts: [0x3f],
    desc: 'Green or blue character display, 2 lines of 16 letters. The backpack needs only 4 wires.',
    sig: [{ p: 'VCC', k: 'v5' }, { p: 'GND', k: 'gnd' }, { p: 'SDA', k: 'sda' }, { p: 'SCL', k: 'scl' }],
    actions: [{ k: 'show', l: 'Show text', msg: true }],
    notes: ['Turn the blue screw on the back if you see only blocks or nothing.', 'If 0x27 does not work, try 0x3F.'],
    libs: { python: ['rplcd'], arduino: ['ard-lcd-i2c'] },
    icon: { pcb: '#1f7a3a', kind: 'lcd' } });

  P({ id: 'tm1637', name: '4-digit display (TM1637)', cat: 'display', iface: 'GPIO', power: 'vcc', ma: 30,
    desc: 'Red clock-style digits. Great for showing one number like CO₂ or distance.',
    sig: [{ p: 'CLK', k: 'gpio', dir: 'out' }, { p: 'DIO', k: 'gpio', dir: 'out' }, { p: 'VCC', k: 'vcc' }, { p: 'GND', k: 'gnd' }],
    actions: [{ k: 'number', l: 'Show a number', value: true }],
    libs: { python: ['py-tm1637'], micropython: ['mip-tm1637'], arduino: ['ard-tm1637'] },
    icon: { pcb: '#1d4f9a', kind: 'digits' } });

  // ---------- Lights and sound ----------
  P({ id: 'led', name: 'LED', cat: 'output', iface: 'GPIO', power: null, ma: 10,
    desc: 'A small light. Always use a 220–330 Ω resistor, or the LED (and pin) can burn out.',
    sig: [{ p: 'Long leg (+)', k: 'gpio', dir: 'out' }, { p: 'Short leg (−)', k: 'gnd' }],
    extra: ['330 Ω resistor in series with the LED'],
    notes: ['Put the 330 Ω resistor between the pin and the long leg.'],
    actions: [{ k: 'onwhile', l: 'Light up while the check is true' }, { k: 'blink', l: 'Blink' }],
    icon: { pcb: 'none', kind: 'led', color: '#e5383b' } });

  P({ id: 'rgbled', name: 'RGB LED (common cathode)', cat: 'output', iface: 'PWM', power: null, ma: 30,
    desc: 'One LED that can glow any colour. Each colour leg needs its own resistor.',
    sig: [{ p: 'Red leg', k: 'pwm' }, { p: 'Long leg (−)', k: 'gnd' }, { p: 'Green leg', k: 'pwm' }, { p: 'Blue leg', k: 'pwm' }],
    extra: ['3 × 330 Ω resistors'],
    actions: [{ k: 'colour', l: 'Glow a colour', colour: true }],
    icon: { pcb: 'none', kind: 'led', color: '#7b6cf6' } });

  P({ id: 'buzzer', name: 'Active buzzer', cat: 'sound', iface: 'GPIO', power: null, ma: 25,
    desc: 'Beeps when its pin is switched on. Good for alarms and button feedback.',
    sig: [{ p: '+ (long leg)', k: 'gpio', dir: 'out' }, { p: '−', k: 'gnd' }],
    actions: [{ k: 'beep', l: 'Beep', beeps: true }],
    icon: { pcb: 'none', kind: 'buzzer' } });

  P({ id: 'i2samp', name: 'I2S speaker amp (MAX98357A)', cat: 'sound', iface: 'I2S', power: 'v5', ma: 300, families: PI,
    desc: 'Tiny 3 W amplifier: connect a speaker to its screw terminal for clear voice and music.',
    sig: [{ p: 'Vin', k: 'v5' }, { p: 'GND', k: 'gnd' }, { p: 'BCLK', k: 'i2s_bclk' }, { p: 'LRC', k: 'i2s_ws' }, { p: 'DIN', k: 'i2s_din' }],
    audio: true, actions: [{ k: 'say', l: 'Say text out loud', msg: true }],
    notes: ['Connect a 4–8 Ω speaker to the + and − screw terminals on the amp.'],
    icon: { pcb: '#1d4f9a', kind: 'chip', chip: '#222', terminal: true } });

  P({ id: 'usbspk', name: 'USB speaker', cat: 'sound', iface: 'USB', port: 'usb', families: PI, ma: 0,
    desc: 'Any USB speaker or USB sound card. The easiest way to make a Pi talk.',
    audio: true, actions: [{ k: 'say', l: 'Say text out loud', msg: true }],
    icon: { pcb: 'none', kind: 'speaker' } });

  P({ id: 'jackspk', name: 'Speaker on audio jack', cat: 'sound', iface: '3.5 mm', port: 'jack', families: PI, ma: 0,
    desc: 'Powered speaker or headphones in the 3.5 mm jack (Pi 3 and Pi 4 only).',
    audio: true, actions: [{ k: 'say', l: 'Say text out loud', msg: true }],
    icon: { pcb: 'none', kind: 'speaker', jack: true } });

  P({ id: 'usbmic', name: 'USB microphone', cat: 'sound', iface: 'USB', port: 'usb', families: PI, ma: 0,
    desc: 'Lets the Pi hear voice commands. Any cheap USB mic or webcam mic works.',
    mic: true, values: [{ k: 'heard', l: 'Words heard', u: 'text', text: true }],
    icon: { pcb: 'none', kind: 'mic' } });

  // ---------- Motors and switching ----------
  P({ id: 'servo', name: 'Servo motor (SG90)', cat: 'motor', iface: 'PWM', power: 'v5', ma: 250,
    desc: 'Turns to an exact angle from 0° to 180°. Good for pointers, flaps and robot arms.',
    sig: [{ p: 'Brown (GND)', k: 'gnd' }, { p: 'Red (5V)', k: 'v5' }, { p: 'Orange (signal)', k: 'pwm' }],
    notes: ['A servo can draw a lot of current when it moves. With more than one, use a separate 5 V supply and join its GND to the board GND.'],
    actions: [{ k: 'angle', l: 'Move to an angle', angle: true }, { k: 'follow', l: 'Follow a reading', value: true }],
    libs: { arduino: ['ard-servo'] },
    icon: { pcb: 'none', kind: 'servo' } });

  P({ id: 'relay', name: 'Relay module (1 channel)', cat: 'motor', iface: 'GPIO', power: 'v5', ma: 70,
    desc: 'An electric switch for lamps, pumps and fans. The board switches the relay; the relay switches the device.',
    sig: [{ p: 'VCC', k: 'v5' }, { p: 'GND', k: 'gnd' }, { p: 'IN', k: 'gpio', dir: 'out' }],
    notes: ['Most modules switch on when IN is LOW; the code handles that.', 'Only switch low voltages (like a 12 V pump) unless you know mains safety.'],
    actions: [{ k: 'onwhile', l: 'Switch on while the check is true' }],
    icon: { pcb: '#1d4f9a', kind: 'relay' } });

  P({ id: 'ws2812', name: 'LED strip (WS2812 / NeoPixel)', cat: 'output', iface: 'Data', power: 'v5', ma: 300,
    desc: 'A strip of colour LEDs you control one by one with a single data pin.',
    sig: [{ p: '+5V', k: 'v5' }, { p: 'GND', k: 'gnd' }, { p: 'DIN', k: 'ws' }],
    notes: ['Each LED can draw 60 mA at full white. More than 8 LEDs need their own 5 V supply.'],
    actions: [{ k: 'colour', l: 'Glow a colour', colour: true }],
    libs: { python: ['py-neopixel'], arduino: ['ard-neopixel'] },
    icon: { pcb: 'none', kind: 'strip' } });

  P({ id: 'stepper', name: 'Stepper 28BYJ-48 + ULN2003', cat: 'motor', iface: 'GPIO', power: 'v5', ma: 240,
    desc: 'Slow, precise motor that turns in small steps. Comes with a little driver board.',
    sig: [{ p: 'IN1', k: 'gpio', dir: 'out' }, { p: 'IN2', k: 'gpio', dir: 'out' }, { p: 'IN3', k: 'gpio', dir: 'out' }, { p: 'IN4', k: 'gpio', dir: 'out' }, { p: '+', k: 'v5' }, { p: '−', k: 'gnd' }],
    actions: [{ k: 'turn', l: 'Turn some steps', steps: true }],
    icon: { pcb: '#1d4f9a', kind: 'stepper' } });

  // ---------- Camera, comms, helpers ----------
  P({ id: 'camera', name: 'Pi Camera Module', cat: 'camera', iface: 'Camera', port: 'csi', families: PI, ma: 250,
    desc: 'Takes photos and video through the ribbon-cable camera socket.',
    actions: [{ k: 'photo', l: 'Take a photo' }],
    notes: ['Blue side of the ribbon faces the Ethernet/USB side on Pi 4; on Pi 5 use the narrow 22-pin cable.'],
    icon: { pcb: '#2e7d32', kind: 'cam' } });

  P({ id: 'hdmi', name: 'HDMI monitor', cat: 'camera', iface: 'HDMI', port: 'hdmi', families: PI, ma: 0,
    desc: 'A screen for the Pi desktop. Many monitors and TVs also play the Pi’s sound.',
    audio: true, actions: [{ k: 'say', l: 'Say text out loud', msg: true }],
    icon: { pcb: 'none', kind: 'monitor' } });

  P({ id: 'gps', name: 'GPS (NEO-6M)', cat: 'comm', iface: 'UART', power: 'v3', ma: 45,
    desc: 'Finds your position from satellites. Needs a view of the sky.',
    sig: [{ p: 'VCC', k: 'v3' }, { p: 'GND', k: 'gnd' }, { p: 'TX', k: 'tx' }, { p: 'RX', k: 'rx' }],
    notes: ['The first fix can take a few minutes outdoors. Code generation for GPS is coming later.'],
    nocode: true, icon: { pcb: '#1d4f9a', kind: 'chip', chip: '#c9a227' } });

  P({ id: 'rc522', name: 'RFID reader (RC522)', cat: 'comm', iface: 'SPI', power: 'v3', ma: 26,
    desc: 'Reads key fobs and cards. 3.3 V only.', only33: true,
    sig: [{ p: 'SDA (SS)', k: 'cs' }, { p: 'SCK', k: 'sck' }, { p: 'MOSI', k: 'mosi' }, { p: 'MISO', k: 'miso' }, { p: 'IRQ', k: 'none' }, { p: 'GND', k: 'gnd' }, { p: 'RST', k: 'gpio', dir: 'out' }, { p: '3.3V', k: 'v3' }],
    notes: ['Leave IRQ unconnected. Code generation for RFID is coming later.'],
    nocode: true, icon: { pcb: '#1d4f9a', kind: 'rfid' } });

  P({ id: 'ads1115', name: 'ADS1115 analog input board', cat: 'helper', iface: 'I2C', power: 'v3', ma: 1, addr: 0x48, alts: [0x49, 0x4a, 0x4b],
    desc: 'Adds 4 analog inputs over I2C. A Raspberry Pi has no analog pins, so this is added for you when you need one.',
    sig: [{ p: 'VDD', k: 'v3' }, { p: 'GND', k: 'gnd' }, { p: 'SCL', k: 'scl' }, { p: 'SDA', k: 'sda' }],
    libs: { python: ['blinka', 'py-ads1x15'] }, families: PI,
    icon: { pcb: '#6a2c91', kind: 'chip', chip: '#222', small: true } });

  // Categories in the order the gallery shows them.
  FM.CATEGORIES = [
    ['all', 'All'], ['air', 'Air & CO₂'], ['climate', 'Temperature'], ['motion', 'Motion'], ['light', 'Light & soil'],
    ['input', 'Buttons & knobs'], ['display', 'Displays'], ['output', 'Lights'], ['sound', 'Sound'], ['motor', 'Motors & relays'],
    ['camera', 'Camera & screen'], ['comm', 'GPS & RFID'], ['helper', 'Helpers'],
  ];
})();
