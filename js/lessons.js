/* Guided lessons. Each step says what to do and checks by itself when it is done,
   so a beginner can follow along without hardware (the simulator stands in for it).
   A check gets a small context: c.has('led'), c.act('blink'), c.read('temperature')... */
(function () {
  const L = (FM.lessons = []);
  const add = (l) => L.push(l);

  add({
    id: 'blink', title: 'Blink your first LED', level: 'First steps', mins: 5, parts: ['led'],
    intro: 'The "hello world" of electronics: one LED, one pin, one program.',
    steps: [
      { text: 'Find the LED in Parts and tap it. It gets connected, and its pins are chosen for you.', target: 'parts', check: (c) => c.has('led') },
      { text: 'Look at the Wiring list next to it. The long leg of the LED goes to a GPIO pin through a resistor; the short leg goes to GND. Tap "Check my wiring" and pick the pins, as if you wired it yourself.', target: 'ability', check: (c) => c.wireChecked },
      { text: 'Now tell the LED what to do. In "What it can do", tap "+ Blink".', target: 'ability', check: (c) => c.act('blink') },
      { text: 'Press "Run the program" under Try it without hardware. The virtual LED blinks every few seconds.', target: 'sim', check: (c) => c.sim.running && c.act('blink') },
      { text: 'Open the Code tab and find the line with "blink". That is the real program your board runs. Press Next when you have found it.', target: 'code', manual: true },
    ],
  });

  add({
    id: 'temperature', title: 'Read a temperature', level: 'First steps', mins: 5, parts: ['dht22'],
    intro: 'Read a sensor, give the value a name and print it.',
    steps: [
      { text: 'Connect a temperature sensor: the DHT22 or the BME280.', target: 'parts', check: (c) => c.has('dht22') || c.has('bme280') || c.has('ds18b20') },
      { text: 'In "What it can do", tap Temperature. It appears in the Read column of your program, called {temperature}.', target: 'ability', check: (c) => c.read('temperature') },
      { text: 'Add an output: in the Do column, tap "+ Add an output" and pick Print.', target: 'program', check: (c) => c.out('print') },
      { text: 'Change the message to something like "It is {temperature} degrees". The preview below it shows what will be printed.', target: 'program', check: (c) => c.msgUses('temperature') },
      { text: 'Run it under Try it, then drag the temperature slider. The terminal shows each new reading.', target: 'sim', check: (c) => c.sim.running && c.touched },
    ],
  });

  add({
    id: 'co2-alarm', title: 'CO₂ alarm with a limit', level: 'Next steps', mins: 8, parts: ['scd40', 'buzzer'],
    intro: 'Beep when the air gets stuffy: read CO₂, check a limit, act only when it is crossed.',
    steps: [
      { text: 'Connect the SCD40 CO₂ sensor.', target: 'parts', check: (c) => c.has('scd40') || c.has('scd30') || c.has('mhz19') },
      { text: 'Tap CO₂ to read it.', target: 'ability', check: (c) => c.read('co2') },
      { text: 'In the Change column, add "Check a limit": when {co2} is above 1000.', target: 'program', check: (c) => c.limit((l) => l.op === '>' && +l.val >= 800) },
      { text: 'Connect the Active buzzer and add its Beep. It is set to beep only when the check is true.', target: 'parts', check: (c) => c.act('beep') },
      { text: 'Run it and drag CO₂ above your limit. The buzzer beeps and the Check turns true. Open a window!', target: 'sim', check: (c) => c.sim.running && c.sim.alert && c.act('beep') && c.prog.steps.some((s) => s.t === 'limit') },
    ],
  });

  add({
    id: 'gyro-x', title: 'Gyro: only the x axis', level: 'Next steps', mins: 8, parts: ['mpu6050'],
    intro: 'Pick one value out of many, do some maths on it and print it your way.',
    steps: [
      { text: 'Connect the MPU6050 gyro and accelerometer.', target: 'parts', check: (c) => c.has('mpu6050') },
      { text: 'It can read seven values. Tap only "Acceleration x".', target: 'ability', check: (c) => c.read('ax') },
      { text: 'Add a step "Do maths": {ax} divided by 9.81 gives the tilt in g. Name the new value x.', target: 'program', check: (c) => c.prog.steps.some((s) => s.t === 'math' && s.a && s.op === '/') },
      { text: 'Print it with your own words, for example "x axis is {x}".', target: 'program', check: (c) => c.prog.actions.some((a) => a.uid === 'print' && /\{\w+\}/.test(a.msg || '') && c.prog.steps.some((s) => s.t === 'math' && (a.msg || '').includes('{' + s.target + '}'))) },
      { text: 'Run it and move the Acceleration x slider.', target: 'sim', check: (c) => c.sim.running && c.touched },
    ],
  });

  add({
    id: 'talk', title: 'Make your Pi talk', level: 'Next steps', mins: 6, family: 'pi', parts: ['usbspk'],
    intro: 'No screen? Let the Pi say the reading out loud.',
    steps: [
      { text: 'Connect a USB speaker (it goes in a USB port, no pins needed).', target: 'parts', check: (c) => c.has('usbspk') || c.has('jackspk') || c.has('i2samp') },
      { text: 'Read something to say. The Pi’s own CPU temperature needs no sensor: in the Read column tap "+ Read something" and pick CPU temperature.', target: 'program', check: (c) => c.prog.reads.length > 0 },
      { text: 'Add the speaker’s "Say text out loud" and write what it should say.', target: 'ability', check: (c) => c.act('say') },
      { text: 'Turn on Sound and run it. Your browser speaks like the Pi will.', target: 'sim', check: (c) => c.sim.running && c.act('say') },
    ],
  });

  add({
    id: 'graph-share', title: 'Graph it and share it', level: 'Projects', mins: 5, parts: [],
    intro: 'Watch values change over time, then save the project and send it to a friend.',
    steps: [
      { text: 'Read at least one value. Any sensor works, or the board’s own uptime.', target: 'program', check: (c) => c.prog.reads.length > 0 },
      { text: 'Add the output "Draw a live graph".', target: 'program', check: (c) => c.out('plot') },
      { text: 'Run it under Try it, set Speed to 20× and choose "up and down" for a sensor. Watch the graph.', target: 'sim', check: (c) => c.sim.running && c.plotted >= 5 },
      { text: 'Open My projects at the top and save it.', target: 'top', check: (c) => c.saved },
      { text: 'Copy the share code there. Anyone can paste it into their own friendly-microman to get your parts, wiring and program. Press Next when done.', target: 'top', manual: true },
    ],
  });

  // Context the checks read from.
  FM.lessonContext = function (S, A, sim, flags) {
    const prog = S.program;
    const inBuild = (id) => A.inst.some((i) => i.def.id === id && i.supported);
    return {
      prog, sim,
      has: inBuild,
      act: (act) => prog.actions.some((a) => a.act === act),
      out: (uid) => prog.actions.some((a) => a.uid === uid),
      read: (k) => prog.reads.some((r) => r.k === k),
      limit: (f) => prog.steps.some((s) => s.t === 'limit' && f(s)),
      // a message the user wrote (not the default) that uses the value
      msgUses: (k) => prog.actions.some((a) => a.msg && a.msg !== FM.defaultMessage(A, prog) && prog.reads.some((r) => r.k === k && a.msg.includes('{' + r.name + '}'))),
      touched: !!(sim && sim.touched),
      plotted: sim && sim.plot && sim.plot.order.length ? sim.plot.data[sim.plot.order[0]].length : 0,
      wireChecked: !!(flags && flags.wireChecked),
      saved: !!(flags && flags.saved),
    };
  };

  // The first step that is not done yet (manual steps count as done once passed).
  FM.lessonProgress = function (lesson, ctx, at) {
    const done = lesson.steps.map((s, k) => (s.manual ? k < at : !!s.check(ctx)));
    return { done, current: Math.min(at, lesson.steps.length) };
  };
})();
