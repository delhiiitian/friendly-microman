/* Starter projects. `parts` lists part ids; in `program`, "@0", "@1"... point at those parts.
   `program` may be a function of the board, for projects that adapt (e.g. CPU temp only on a Pi). */
(function () {
  const T = FM.registerTemplate;

  T({ id: 'co2-announcer', title: 'CO₂ announcer', family: 'pi',
    desc: 'Reads CO₂ every 5 seconds, prints it, and says "please open a window" out loud when the air gets stuffy. No screen needed.',
    learn: 'Reading an I2C sensor, smoothing, a limit check, speech output with a cool-down.',
    parts: ['scd40', 'usbspk'],
    program: { mode: 'loop', interval: 5,
      reads: [{ uid: '@0', k: 'co2', name: 'co2' }],
      steps: [{ t: 'smooth', key: 'co2', n: 3 }, { t: 'limit', key: 'co2', op: '>', val: 1000 }],
      actions: [
        { uid: 'print', act: 'print', when: 'always', every: 0, msg: 'CO2: {co2} ppm' },
        { uid: '@1', act: 'say', when: 'alert', every: 120, msg: 'Carbon dioxide is {co2} parts per million. Please open a window.' },
      ] } });

  T({ id: 'co2-screen', title: 'CO₂ monitor with screen',
    desc: 'Shows CO₂, temperature and humidity on a small OLED and beeps when CO₂ passes 1200 ppm. Works on every board.',
    learn: 'Several values in one message, a display, and an alarm that repeats at most every 5 minutes.',
    parts: ['scd40', 'oled', 'buzzer'],
    program: { mode: 'loop', interval: 5,
      reads: [{ uid: '@0', k: 'co2', name: 'co2' }, { uid: '@0', k: 'temperature', name: 'temp' }, { uid: '@0', k: 'humidity', name: 'hum' }],
      steps: [{ t: 'limit', key: 'co2', op: '>', val: 1200 }],
      actions: [
        { uid: '@1', act: 'show', when: 'always', every: 0, msg: 'CO2 {co2} ppm  Temp {temp} C  Humidity {hum} %' },
        { uid: 'print', act: 'print', when: 'always', every: 0, msg: 'CO2 {co2} ppm, {temp} C, {hum} %' },
        { uid: '@2', act: 'beep', when: 'alert', every: 300, n: 3 },
      ] } });

  T({ id: 'voice-commands', title: 'Pi voice command listener', family: 'pi',
    desc: 'Say "what time is it", "carbon dioxide" or "light on" and the Pi answers through the speaker. Runs offline.',
    learn: 'Speech recognition, matching words to actions, replying with speech.',
    parts: ['usbmic', 'usbspk', 'led', 'scd40'],
    program: { mode: 'listen', listen: { via: 'voice', replies: ['print', '@1'], rules: [
      { say: 'time', do: 'time' },
      { say: 'carbon, co2, air', do: 'reading', uid: '@3', k: 'co2', text: 'Carbon dioxide is {value} parts per million' },
      { say: 'light on, lights on', do: 'on', uid: '@2' },
      { say: 'light off, lights off', do: 'off', uid: '@2' },
      { say: 'hello', do: 'text', text: 'Hello! I am your Raspberry Pi.' },
      { say: 'goodbye, stop', do: 'stop' },
    ] } } });

  T({ id: 'typed-commands', title: 'Typed command helper',
    desc: 'No parts needed. Type commands like "time" or "temperature" and the board answers. A gentle first program.',
    learn: 'Reading input, if/elif decisions, built-in board values.',
    parts: [],
    program: (board) => ({ mode: 'listen', listen: { via: 'typed', replies: ['print'], rules: [
      { say: 'time', do: 'time' },
      board.family === 'pi' ? { say: 'temperature, hot', do: 'reading', uid: 'sys', k: 'cpu_temp', text: 'My CPU is at {value} degrees' }
        : board.internalTemp ? { say: 'temperature, hot', do: 'reading', uid: 'sys', k: 'chip_temp', text: 'My chip is at {value} degrees' }
          : { say: 'uptime', do: 'reading', uid: 'sys', k: 'uptime', text: 'I have been running {value} seconds' },
      { say: 'hello, hi', do: 'text', text: 'Hello! Nice to meet you.' },
      { say: 'bye, stop', do: 'stop' },
    ] } }) });

  T({ id: 'gyro-axis', title: 'Gyro x-axis reader',
    desc: 'Reads only the x axis of an MPU6050 twice a second, converts it to g, and prints "x axis is ...".',
    learn: 'Picking one channel from a sensor, doing maths on it, formatting the text.',
    parts: ['mpu6050'],
    program: { mode: 'loop', interval: 0.5,
      reads: [{ uid: '@0', k: 'ax', name: 'x' }],
      steps: [{ t: 'math', target: 'x_g', a: 'x', op: '/', b: 9.81 }, { t: 'math', target: 'x_g', a: 'x_g', op: 'round', b: 2 }],
      actions: [{ uid: 'print', act: 'print', when: 'always', every: 0, msg: 'x axis is {x} m/s2 ({x_g} g)' }] } });

  T({ id: 'motion-alarm', title: 'Motion alarm',
    desc: 'A PIR sensor watches the room. When someone moves, the LED lights and the buzzer beeps.',
    learn: 'Yes/no sensors, a check, and outputs that follow it.',
    parts: ['pir', 'buzzer', 'led'],
    program: { mode: 'loop', interval: 0.5,
      reads: [{ uid: '@0', k: 'motion', name: 'motion' }],
      steps: [{ t: 'limit', key: 'motion', op: 'yes' }],
      actions: [
        { uid: '@2', act: 'onwhile', when: 'always', every: 0 },
        { uid: '@1', act: 'beep', when: 'alert', every: 10, n: 2 },
        { uid: 'print', act: 'print', when: 'alert', every: 10, msg: 'Motion detected!' },
      ] } });

  T({ id: 'plant-helper', title: 'Thirsty plant light',
    desc: 'Checks the soil once a minute and turns on a red LED when the plant needs water.',
    learn: 'Analog sensors (and the auto-added ADC on a Pi), calibration, "below" checks.',
    parts: ['soil', 'led'],
    program: { mode: 'loop', interval: 60,
      reads: [{ uid: '@0', k: 'moisture', name: 'moisture' }],
      steps: [{ t: 'limit', key: 'moisture', op: '<', val: 30 }],
      actions: [
        { uid: '@1', act: 'onwhile', when: 'always', every: 0 },
        { uid: 'print', act: 'print', when: 'always', every: 0, msg: 'Soil moisture: {moisture} %' },
      ] } });

  T({ id: 'weather-logger', title: 'Weather station logger',
    desc: 'Temperature, humidity and pressure on a 16×2 LCD, saved to a CSV file every minute.',
    learn: 'Logging data you can open in a spreadsheet.',
    parts: ['bme280', 'lcd1602'],
    program: { mode: 'loop', interval: 60,
      reads: [{ uid: '@0', k: 'temperature', name: 'temp' }, { uid: '@0', k: 'humidity', name: 'hum' }, { uid: '@0', k: 'pressure', name: 'hpa' }],
      steps: [],
      actions: [
        { uid: '@1', act: 'show', when: 'always', every: 0, msg: '{temp}C {hum}%     {hpa} hPa' },
        { uid: 'log', act: 'log', when: 'always', every: 0 },
        { uid: 'print', act: 'print', when: 'always', every: 0, msg: '{temp} C, {hum} %, {hpa} hPa' },
      ] } });

  T({ id: 'parking', title: 'Parking distance beeper',
    desc: 'An ultrasonic sensor measures the distance and beeps when something is closer than 20 cm.',
    learn: 'Distance sensors and 5 V signals on 3.3 V boards.',
    parts: ['hcsr04', 'buzzer'],
    program: { mode: 'loop', interval: 0.3,
      reads: [{ uid: '@0', k: 'distance', name: 'distance' }],
      steps: [{ t: 'limit', key: 'distance', op: '<', val: 20 }],
      actions: [
        { uid: '@1', act: 'beep', when: 'alert', every: 0, n: 1 },
        { uid: 'print', act: 'print', when: 'always', every: 0, msg: 'Distance {distance} cm' },
      ] } });

  T({ id: 'co2-needle', title: 'CO₂ needle gauge',
    desc: 'A servo arm points at the CO₂ level like a car dashboard needle: 400 ppm left, 2000 ppm right.',
    learn: 'Mapping a reading to a movement.',
    parts: ['scd40', 'servo'],
    program: { mode: 'loop', interval: 5,
      reads: [{ uid: '@0', k: 'co2', name: 'co2' }],
      steps: [],
      actions: [
        { uid: '@1', act: 'follow', when: 'always', every: 0, key: 'co2', min: 400, max: 2000 },
        { uid: 'print', act: 'print', when: 'always', every: 0, msg: 'CO2 {co2} ppm' },
      ] } });
})();
