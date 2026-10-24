/* ESP32 (30-pin DevKit V1) and ESP8266 (NodeMCU v2/v3). Pin ids are the GPIO names. */
(function () {
  const mk = (list) => {
    const o = {};
    list.forEach(([id, label, type, gpio, fn]) => { o[id] = { label, type, gpio, fn }; });
    return o;
  };

  // ---- ESP32 DevKit V1 (DOIT, 30 pins), antenna up, USB at the bottom ----
  const esp32Pins = mk([
    ['EN', 'EN', 'sys', null, 'Reset button line'],
    ['G36', 'VP', 'adc', 36, 'GPIO36 · ADC1 · input only'], ['G39', 'VN', 'adc', 39, 'GPIO39 · ADC1 · input only'],
    ['G34', 'D34', 'adc', 34, 'ADC1 · input only'], ['G35', 'D35', 'adc', 35, 'ADC1 · input only'],
    ['G32', 'D32', 'adc', 32, 'ADC1 · touch'], ['G33', 'D33', 'adc', 33, 'ADC1 · touch'],
    ['G25', 'D25', 'gpio', 25, 'DAC1 · I2S'], ['G26', 'D26', 'gpio', 26, 'DAC2 · I2S'], ['G27', 'D27', 'gpio', 27, 'touch'],
    ['G14', 'D14', 'gpio', 14, 'touch'], ['G12', 'D12', 'sys', 12, 'Boot strapping pin · avoid'], ['G13', 'D13', 'gpio', 13, 'touch'],
    ['GND1', 'GND', 'gnd'], ['VIN', 'VIN', 'v5', null, '5 V from USB, or power in'],
    ['G23', 'D23', 'spi', 23, 'VSPI MOSI'], ['G22', 'D22', 'i2c', 22, 'I2C SCL'],
    ['G1', 'TX0', 'sys', 1, 'USB serial TX · leave free'], ['G3', 'RX0', 'sys', 3, 'USB serial RX · leave free'],
    ['G21', 'D21', 'i2c', 21, 'I2C SDA'], ['G19', 'D19', 'spi', 19, 'VSPI MISO'], ['G18', 'D18', 'spi', 18, 'VSPI SCK'],
    ['G5', 'D5', 'spi', 5, 'VSPI CS · strapping'], ['G17', 'TX2', 'uart', 17, 'UART2 TX'], ['G16', 'RX2', 'uart', 16, 'UART2 RX'],
    ['G4', 'D4', 'gpio', 4], ['G2', 'D2', 'gpio', 2, 'On-board LED · strapping'], ['G15', 'D15', 'gpio', 15, 'strapping'],
    ['GND2', 'GND', 'gnd'], ['3V3', '3V3', 'v3', null, '3.3 V out'],
  ]);

  FM.registerBoard({
    id: 'esp32', family: 'esp32', name: 'ESP32 DevKit (30-pin)', short: 'ESP32', chip: 'ESP32-WROOM-32',
    blurb: 'Microcontroller with Wi-Fi and Bluetooth. 3.3 V logic. Pins 34–39 can only read.',
    logic: 3.3, refStyle: 'silk', pins: esp32Pins,
    layout: { kind: 'sides', left: ['EN', 'G36', 'G39', 'G34', 'G35', 'G32', 'G33', 'G25', 'G26', 'G27', 'G14', 'G12', 'G13', 'GND1', 'VIN'],
      right: ['G23', 'G22', 'G1', 'G3', 'G21', 'G19', 'G18', 'G5', 'G17', 'G16', 'G4', 'G2', 'G15', 'GND2', '3V3'] },
    bus: {
      i2c: { sda: 'G21', scl: 'G22', id: 0 },
      spi: { mosi: 'G23', miso: 'G19', sck: 'G18', cs: ['G5'], id: 2 },
      uart: [{ tx: 'G17', rx: 'G16', id: 2 }, { tx: 'G13', rx: 'G14', id: 1, note: 'UART1 moved to D13/D14 in code.' }],
      i2s: { bclk: 'G26', ws: 'G25', dout: 'G27' }, w1: { any: true }, ws: 'any',
    },
    pwm: 'all',
    adc: [{ pin: 'G34', ch: 6 }, { pin: 'G35', ch: 7 }, { pin: 'G32', ch: 4 }, { pin: 'G33', ch: 5 }, { pin: 'G36', ch: 0 }, { pin: 'G39', ch: 3 }],
    inputOnly: ['G34', 'G35', 'G36', 'G39'],
    gpioPool: ['G4', 'G13', 'G14', 'G27', 'G26', 'G25', 'G32', 'G33', 'G16', 'G17', 'G18', 'G19', 'G23', 'G5', 'G15', 'G2'],
    power: { v3: ['3V3'], v5: ['VIN'], gnd: ['GND1', 'GND2'] },
    avoid: { G12: 'Must be low at boot or the board will not start', G1: 'Used by USB serial', G3: 'Used by USB serial' },
    outline: { w: 280, h: 540, usb: 'bottom' },
    ports: [{ k: 'usb', l: 'micro-USB', x: 115, y: 520, w: 50, h: 40 }],
    usbIds: [{ vid: 0x10c4, note: 'CP210x (common on ESP32 DevKits)' }, { vid: 0x1a86, note: 'CH340 (ESP32, ESP8266 and Arduino clones)' }, { vid: 0x303a, note: 'Espressif native USB' }],
    firmware: 'https://micropython.org/download/ESP32_GENERIC/',
    fqbn: 'esp32:esp32:esp32',
  });

  // ---- ESP8266 NodeMCU ----
  const espPins = mk([
    ['A0', 'A0', 'adc', null, 'Only analog input · 0–3.3 V on NodeMCU'],
    ['RSV1', 'RSV', 'sys'], ['RSV2', 'RSV', 'sys'],
    ['SD3', 'SD3', 'sys', 10, 'Flash memory · leave free'], ['SD2', 'SD2', 'sys', 9, 'Flash memory · leave free'],
    ['SD1', 'SD1', 'sys', null, 'Flash'], ['CMD', 'CMD', 'sys', null, 'Flash'], ['SD0', 'SD0', 'sys', null, 'Flash'], ['CLK', 'CLK', 'sys', null, 'Flash'],
    ['GNDa', 'GND', 'gnd'], ['3V3a', '3V3', 'v3'], ['EN', 'EN', 'sys'], ['RST', 'RST', 'sys', null, 'Reset'], ['GNDb', 'GND', 'gnd'], ['VIN', 'Vin', 'v5', null, '5 V from USB, or power in'],
    ['D0', 'D0', 'gpio', 16, 'GPIO16 · no PWM, wakes from deep sleep'], ['D1', 'D1', 'i2c', 5, 'GPIO5 · I2C SCL'], ['D2', 'D2', 'i2c', 4, 'GPIO4 · I2C SDA'],
    ['D3', 'D3', 'gpio', 0, 'GPIO0 · FLASH button · keep high at boot'], ['D4', 'D4', 'gpio', 2, 'GPIO2 · on-board LED · keep high at boot'],
    ['3V3b', '3V3', 'v3'], ['GNDc', 'GND', 'gnd'],
    ['D5', 'D5', 'spi', 14, 'GPIO14 · SPI SCK'], ['D6', 'D6', 'spi', 12, 'GPIO12 · SPI MISO'], ['D7', 'D7', 'spi', 13, 'GPIO13 · SPI MOSI'], ['D8', 'D8', 'spi', 15, 'GPIO15 · SPI CS · keep low at boot'],
    ['RX', 'RX', 'sys', 3, 'USB serial'], ['TX', 'TX', 'sys', 1, 'USB serial'], ['GNDd', 'GND', 'gnd'], ['3V3c', '3V3', 'v3'],
  ]);

  FM.registerBoard({
    id: 'esp8266', family: 'esp8266', name: 'ESP8266 NodeMCU', short: 'ESP8266', chip: 'ESP-12E',
    blurb: 'Cheap Wi-Fi microcontroller with only a handful of free pins and one analog input.',
    logic: 3.3, refStyle: 'silk', pins: espPins,
    layout: { kind: 'sides', left: ['A0', 'RSV1', 'RSV2', 'SD3', 'SD2', 'SD1', 'CMD', 'SD0', 'CLK', 'GNDa', '3V3a', 'EN', 'RST', 'GNDb', 'VIN'],
      right: ['D0', 'D1', 'D2', 'D3', 'D4', '3V3b', 'GNDc', 'D5', 'D6', 'D7', 'D8', 'RX', 'TX', 'GNDd', '3V3c'] },
    bus: {
      i2c: { sda: 'D2', scl: 'D1', soft: true },
      spi: { mosi: 'D7', miso: 'D6', sck: 'D5', cs: ['D8'], id: 1 },
      uart: [{ soft: true, note: 'The ESP8266 has one usable serial port and it is used by USB, so the program uses a software serial port.' }],
      i2s: null, w1: { any: true }, ws: 'any',
    },
    pwm: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'],
    adc: [{ pin: 'A0', ch: 0 }],
    gpioPool: ['D5', 'D6', 'D7', 'D0', 'D1', 'D2', 'D4', 'D3', 'D8'],
    power: { v3: ['3V3a', '3V3b', '3V3c'], v5: ['VIN'], gnd: ['GNDa', 'GNDb', 'GNDc', 'GNDd'] },
    outline: { w: 280, h: 540, usb: 'bottom' },
    ports: [{ k: 'usb', l: 'micro-USB', x: 115, y: 520, w: 50, h: 40 }],
    usbIds: [{ vid: 0x1a86, note: 'CH340' }, { vid: 0x10c4, note: 'CP210x' }],
    firmware: 'https://micropython.org/download/ESP8266_GENERIC/',
    fqbn: 'esp8266:esp8266:nodemcuv2',
  });
})();
