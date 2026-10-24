/* Arduino Uno R3 (also Nano, same ATmega328P pins). 5 V logic. */
(function () {
  const list = [
    ['IOREF', 'IOREF', 'sys', null, 'Tells shields the logic voltage'], ['RESET', 'RESET', 'sys', null, 'Reset'],
    ['3V3', '3.3V', 'v3', null, '3.3 V out, about 50 mA only'], ['5V', '5V', 'v5', null, '5 V out'],
    ['GND1', 'GND', 'gnd'], ['GND2', 'GND', 'gnd'], ['VIN', 'VIN', 'vin', null, 'Power in 7–12 V'],
    ['A0', 'A0', 'adc', 14], ['A1', 'A1', 'adc', 15], ['A2', 'A2', 'adc', 16], ['A3', 'A3', 'adc', 17],
    ['A4', 'A4', 'i2c', 18, 'I2C SDA · analog 4'], ['A5', 'A5', 'i2c', 19, 'I2C SCL · analog 5'],
    ['SCL', 'SCL', 'i2c', 19, 'Same as A5'], ['SDA', 'SDA', 'i2c', 18, 'Same as A4'], ['AREF', 'AREF', 'sys', null, 'Analog reference'], ['GND3', 'GND', 'gnd'],
    ['D13', 'D13', 'spi', 13, 'SPI SCK · on-board LED'], ['D12', 'D12', 'spi', 12, 'SPI MISO'], ['D11', '~D11', 'spi', 11, 'SPI MOSI · PWM'], ['D10', '~D10', 'spi', 10, 'SPI SS · PWM'],
    ['D9', '~D9', 'pwm', 9, 'PWM'], ['D8', 'D8', 'gpio', 8],
    ['D7', 'D7', 'gpio', 7], ['D6', '~D6', 'pwm', 6, 'PWM'], ['D5', '~D5', 'pwm', 5, 'PWM'], ['D4', 'D4', 'gpio', 4],
    ['D3', '~D3', 'pwm', 3, 'PWM · interrupt'], ['D2', 'D2', 'gpio', 2, 'interrupt'], ['D1', 'TX→1', 'sys', 1, 'USB serial · leave free'], ['D0', 'RX←0', 'sys', 0, 'USB serial · leave free'],
  ];
  const pins = {};
  list.forEach(([id, label, type, gpio, fn]) => { pins[id] = { label, type, gpio, fn }; });

  FM.registerBoard({
    id: 'uno', family: 'arduino', name: 'Arduino Uno R3 / Nano', short: 'Uno', chip: 'ATmega328P',
    blurb: '5 V logic, so 5 V sensors plug straight in. Parts marked 3.3 V only need a level shifter.',
    logic: 5, refStyle: 'silk', pins,
    layout: { kind: 'sides', left: ['IOREF', 'RESET', '3V3', '5V', 'GND1', 'GND2', 'VIN', null, 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
      right: ['SCL', 'SDA', 'AREF', 'GND3', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8', null, 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'] },
    bus: {
      i2c: { sda: 'A4', scl: 'A5', alias: { sda: 'SDA', scl: 'SCL' } },
      spi: { mosi: 'D11', miso: 'D12', sck: 'D13', cs: ['D10'] },
      uart: [{ soft: true, note: 'Pins 0 and 1 are used by USB, so the sketch uses SoftwareSerial on two free pins.' }],
      i2s: null, w1: { any: true }, ws: 'any',
    },
    pwm: ['D3', 'D5', 'D6', 'D9', 'D10', 'D11'],
    adc: [{ pin: 'A0', ch: 0 }, { pin: 'A1', ch: 1 }, { pin: 'A2', ch: 2 }, { pin: 'A3', ch: 3 }],
    adcMax: 1023,
    gpioPool: ['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D12', 'D11', 'D10', 'D13', 'A3', 'A2', 'A1', 'A0'],
    power: { v3: ['3V3'], v5: ['5V'], gnd: ['GND1', 'GND2', 'GND3'] },
    avoid: { D0: 'Used by USB serial', D1: 'Used by USB serial' },
    outline: { w: 540, h: 400, usb: 'left' },
    ports: [{ k: 'usb', l: 'USB-B', x: -20, y: 60, w: 70, h: 60 }, { k: 'pwr', l: 'DC jack 7–12 V', x: -15, y: 280, w: 60, h: 55 }],
    usbIds: [{ vid: 0x2341, note: 'Arduino' }, { vid: 0x2a03, note: 'Arduino' }, { vid: 0x1a86, note: 'CH340 clone' }, { vid: 0x0403, note: 'FTDI' }],
    fqbn: 'arduino:avr:uno',
  });
})();
