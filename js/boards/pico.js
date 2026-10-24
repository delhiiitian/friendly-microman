/* Raspberry Pi Pico family (Pico, Pico W, Pico 2, Pico 2 W). Pin ids are physical pins 1-40. */
(function () {
  const P = {
    1: ['GP0', 'uart', 0, 'UART0 TX · I2C0 SDA'], 2: ['GP1', 'uart', 1, 'UART0 RX · I2C0 SCL'], 3: ['GND', 'gnd'],
    4: ['GP2', 'gpio', 2, 'SPI0 SCK · I2C1 SDA'], 5: ['GP3', 'gpio', 3, 'SPI0 TX · I2C1 SCL'],
    6: ['GP4', 'i2c', 4, 'I2C0 SDA · UART1 TX'], 7: ['GP5', 'i2c', 5, 'I2C0 SCL · UART1 RX'], 8: ['GND', 'gnd'],
    9: ['GP6', 'gpio', 6, 'I2C1 SDA'], 10: ['GP7', 'gpio', 7, 'I2C1 SCL'],
    11: ['GP8', 'uart', 8, 'UART1 TX'], 12: ['GP9', 'uart', 9, 'UART1 RX'], 13: ['GND', 'gnd'],
    14: ['GP10', 'gpio', 10, 'SPI1 SCK'], 15: ['GP11', 'gpio', 11, 'SPI1 TX'],
    16: ['GP12', 'gpio', 12, 'SPI1 RX'], 17: ['GP13', 'gpio', 13, 'SPI1 CSn'], 18: ['GND', 'gnd'],
    19: ['GP14', 'gpio', 14], 20: ['GP15', 'gpio', 15],
    21: ['GP16', 'spi', 16, 'SPI0 RX (MISO)'], 22: ['GP17', 'spi', 17, 'SPI0 CSn (chip select)'], 23: ['GND', 'gnd'],
    24: ['GP18', 'spi', 18, 'SPI0 SCK'], 25: ['GP19', 'spi', 19, 'SPI0 TX (MOSI)'],
    26: ['GP20', 'gpio', 20], 27: ['GP21', 'gpio', 21], 28: ['GND', 'gnd'], 29: ['GP22', 'gpio', 22],
    30: ['RUN', 'sys', null, 'Reset · connect to GND to restart'],
    31: ['GP26', 'adc', 26, 'ADC0'], 32: ['GP27', 'adc', 27, 'ADC1'], 33: ['AGND', 'gnd', null, 'Analog ground'],
    34: ['GP28', 'adc', 28, 'ADC2'], 35: ['ADC_VREF', 'sys', null, 'Analog reference'],
    36: ['3V3(OUT)', 'v3', null, '3.3 V out, up to about 300 mA'], 37: ['3V3_EN', 'sys', null, 'Pull low to turn 3.3 V off'],
    38: ['GND', 'gnd'], 39: ['VSYS', 'vin', null, 'Power in 1.8–5.5 V'], 40: ['VBUS', 'v5', null, '5 V from USB'],
  };
  const pins = {};
  Object.entries(P).forEach(([n, [label, type, gpio, fn]]) => { pins[n] = { label, type, gpio, fn }; });
  const left = [], right = [];
  for (let i = 1; i <= 20; i++) left.push(String(i));
  for (let i = 40; i >= 21; i--) right.push(String(i));

  FM.registerBoard({
    id: 'pico', family: 'pico', name: 'Raspberry Pi Pico / Pico W / Pico 2', short: 'Pico', chip: 'RP2040 / RP2350',
    blurb: 'A tiny microcontroller, not a computer. Runs one program from boot. Every GP pin can do PWM.',
    logic: 3.3, refStyle: 'number', pins,
    layout: { kind: 'sides', left, right },
    bus: {
      i2c: { sda: '6', scl: '7', id: 0 },
      spi: { mosi: '25', miso: '21', sck: '24', cs: ['22'], id: 0 },
      uart: [{ tx: '11', rx: '12', id: 1 }, { tx: '1', rx: '2', id: 0, note: 'UART0 is free because the Pico talks to your computer over native USB.' }],
      i2s: { flexible: true }, w1: { any: true }, ws: 'any',
    },
    pwm: 'all',
    adc: [{ pin: '31', ch: 0 }, { pin: '32', ch: 1 }, { pin: '34', ch: 2 }],
    gpioPool: ['19', '20', '26', '27', '29', '14', '15', '16', '17', '9', '10', '4', '5', '1', '2', '11', '12', '21', '22', '24', '25', '6', '7', '31', '32', '34'],
    power: { v3: ['36'], v5: ['40'], gnd: ['3', '8', '13', '18', '23', '28', '38'] },
    internalTemp: true,
    outline: { w: 210, h: 510, usb: 'top' },
    ports: [{ k: 'usb', l: 'micro-USB', x: 80, y: -12, w: 50, h: 40 }],
    usbIds: [{ vid: 0x2e8a, note: 'Raspberry Pi (Pico)' }],
    firmware: 'https://micropython.org/download/RPI_PICO/',
    fqbn: 'rp2040:rp2040:rpipico',
  });
})();
