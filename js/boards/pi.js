/* Raspberry Pi boards with the 40-pin header (Pi 2, 3, 4, 400, 5, Zero family).
   Pin ids are the physical header numbers 1-40. */
(function () {
  const H = [
    [1, '3V3', 'v3'], [2, '5V', 'v5'],
    [3, 'GPIO2', 'i2c', 2, 'SDA · I2C data'], [4, '5V', 'v5'],
    [5, 'GPIO3', 'i2c', 3, 'SCL · I2C clock'], [6, 'GND', 'gnd'],
    [7, 'GPIO4', 'gpio', 4, 'GPCLK0 · default 1-Wire pin'], [8, 'GPIO14', 'uart', 14, 'TXD · serial transmit'],
    [9, 'GND', 'gnd'], [10, 'GPIO15', 'uart', 15, 'RXD · serial receive'],
    [11, 'GPIO17', 'gpio', 17], [12, 'GPIO18', 'pwm', 18, 'PWM0 · I2S clock (BCLK)'],
    [13, 'GPIO27', 'gpio', 27], [14, 'GND', 'gnd'],
    [15, 'GPIO22', 'gpio', 22], [16, 'GPIO23', 'gpio', 23],
    [17, '3V3', 'v3'], [18, 'GPIO24', 'gpio', 24],
    [19, 'GPIO10', 'spi', 10, 'MOSI · SPI data out'], [20, 'GND', 'gnd'],
    [21, 'GPIO9', 'spi', 9, 'MISO · SPI data in'], [22, 'GPIO25', 'gpio', 25],
    [23, 'GPIO11', 'spi', 11, 'SCLK · SPI clock'], [24, 'GPIO8', 'spi', 8, 'CE0 · SPI chip select 0'],
    [25, 'GND', 'gnd'], [26, 'GPIO7', 'spi', 7, 'CE1 · SPI chip select 1'],
    [27, 'ID_SD', 'sys', 0, 'HAT ID EEPROM data · leave free'], [28, 'ID_SC', 'sys', 1, 'HAT ID EEPROM clock · leave free'],
    [29, 'GPIO5', 'gpio', 5], [30, 'GND', 'gnd'],
    [31, 'GPIO6', 'gpio', 6], [32, 'GPIO12', 'pwm', 12, 'PWM0'],
    [33, 'GPIO13', 'pwm', 13, 'PWM1'], [34, 'GND', 'gnd'],
    [35, 'GPIO19', 'pwm', 19, 'PWM1 · I2S frame (LRCLK)'], [36, 'GPIO16', 'gpio', 16],
    [37, 'GPIO26', 'gpio', 26], [38, 'GPIO20', 'gpio', 20, 'I2S data in'],
    [39, 'GND', 'gnd'], [40, 'GPIO21', 'gpio', 21, 'I2S data out'],
  ];

  function pins() {
    const o = {};
    H.forEach(([n, label, type, gpio, fn]) => { o[n] = { label, type, gpio, fn }; });
    return o;
  }

  const left = [], right = [];
  for (let i = 1; i <= 40; i += 2) { left.push(String(i)); right.push(String(i + 1)); }

  // GPIO numbers in the order we like to hand them out: plain pins first,
  // then pins whose special job is unused, and the I2C pins (fixed pull-ups) last.
  const POOL_BCM = [17, 27, 22, 23, 24, 25, 5, 6, 16, 26, 20, 21, 12, 13, 19, 18, 4, 14, 15, 10, 9, 11, 8, 7, 3, 2];
  const bcmToPhys = {};
  H.forEach(([n, , , gpio, ]) => { if (gpio != null && n !== 27 && n !== 28) bcmToPhys[gpio] = String(n); });

  const base = {
    family: 'pi', logic: 3.3, refStyle: 'number',
    layout: { kind: 'paired', left, right },
    bus: {
      i2c: { sda: '3', scl: '5', how: 'sudo raspi-config nonint do_i2c 0' },
      spi: { mosi: '19', miso: '21', sck: '23', cs: ['24', '26'], how: 'sudo raspi-config nonint do_spi 0' },
      uart: [{ tx: '8', rx: '10', dev: '/dev/serial0', how: ['sudo raspi-config nonint do_serial_hw 0', 'sudo raspi-config nonint do_serial_cons 1'] }],
      i2s: { bclk: '12', ws: '35', dout: '40', din: '38' },
      w1: { pin: '7', fixed: false },
      ws: ['12', '19'],
    },
    pwm: ['32', '33', '12', '35'],
    adc: [], // no analog inputs: an ADS1115 is added automatically
    gpioPool: POOL_BCM.map((b) => bcmToPhys[b]),
    power: { v3: ['1', '17'], v5: ['2', '4'], gnd: ['6', '9', '14', '20', '25', '30', '34', '39'] },
    avoid: { 27: 'Used to identify HAT boards', 28: 'Used to identify HAT boards' },
    usbIds: [],
  };

  // Board drawings: coordinates in tenths of a millimetre-ish units, origin top-left of the PCB.
  const big = { w: 850, h: 560, header: { x: 70, y: 12, pitch: 25.4 } };
  const smallZero = { w: 650, h: 300, header: { x: 70, y: 12, pitch: 25.4 } };

  const R = (k, l, x, y, w, h, extra) => Object.assign({ k, l, x, y, w, h }, extra || {});

  FM.registerBoard(Object.assign({}, base, {
    id: 'pi5', name: 'Raspberry Pi 5', short: 'Pi 5', chip: 'BCM2712 + RP1',
    blurb: 'Fastest Pi. No headphone jack, so use a USB speaker, HDMI audio or an I2S amp for sound.',
    pins: pins(), outline: big, jack: false,
    uartExtra: { tx: '7', rx: '29', dev: '/dev/ttyAMA2', overlay: 'dtoverlay=uart2' },
    ports: [
      R('usb', 'USB ×2', 690, 20, 180, 135), R('usb', 'USB ×2', 690, 195, 180, 135), R('eth', 'Ethernet', 700, 380, 170, 160),
      R('pwr', 'USB-C power', 70, 500, 95, 75), R('hdmi', 'micro HDMI 0', 225, 505, 70, 60), R('hdmi', 'micro HDMI 1', 355, 505, 70, 60),
      R('csi', 'Camera/Display 0', 470, 400, 28, 120), R('csi', 'Camera/Display 1', 540, 400, 28, 120),
      R('pcie', 'PCIe', 40, 150, 28, 150), R('fan', 'Fan', 600, 80, 50, 22), R('sd', 'microSD (underneath)', -15, 330, 45, 110, { dashed: true }),
    ],
  }));

  FM.registerBoard(Object.assign({}, base, {
    id: 'pi4', name: 'Raspberry Pi 4 / Pi 400', short: 'Pi 4', chip: 'BCM2711',
    blurb: 'The most common Pi for projects. Has a 3.5 mm audio jack for a simple speaker.',
    pins: pins(), outline: big, jack: true,
    uartExtra: { tx: '7', rx: '29', dev: '/dev/ttyAMA3', overlay: 'dtoverlay=uart3' },
    ports: [
      R('eth', 'Ethernet', 700, 15, 170, 150), R('usb', 'USB ×2', 690, 200, 180, 135), R('usb', 'USB ×2', 690, 375, 180, 135),
      R('pwr', 'USB-C power', 70, 500, 95, 75), R('hdmi', 'micro HDMI 0', 225, 505, 70, 60), R('hdmi', 'micro HDMI 1', 355, 505, 70, 60),
      R('csi', 'Camera', 455, 420, 28, 120), R('jack', 'Audio jack', 530, 480, 65, 100),
      R('dsi', 'Display', 10, 170, 28, 130), R('sd', 'microSD (underneath)', -15, 330, 45, 110, { dashed: true }),
    ],
  }));

  FM.registerBoard(Object.assign({}, base, {
    id: 'pi3', name: 'Raspberry Pi 3 / 3 B+ / 2', short: 'Pi 3', chip: 'BCM2837',
    blurb: 'Older but still great for sensors. Powered by micro-USB; has an audio jack.',
    pins: pins(), outline: big, jack: true, uartExtra: null,
    ports: [
      R('usb', 'USB ×2', 690, 20, 180, 135), R('usb', 'USB ×2', 690, 200, 180, 135), R('eth', 'Ethernet', 700, 380, 170, 160),
      R('pwr', 'micro-USB power', 80, 515, 80, 55), R('hdmi', 'HDMI', 250, 480, 150, 95),
      R('csi', 'Camera', 455, 420, 28, 120), R('jack', 'Audio jack', 530, 480, 65, 100),
      R('dsi', 'Display', 10, 170, 28, 130), R('sd', 'microSD (underneath)', -15, 330, 45, 110, { dashed: true }),
    ],
  }));

  FM.registerBoard(Object.assign({}, base, {
    id: 'zero', name: 'Raspberry Pi Zero 2 W / Zero W', short: 'Pi Zero', chip: 'RP3A0 / BCM2835',
    blurb: 'Tiny and cheap. One USB data port (use an OTG adapter or hub) and no audio jack.',
    pins: pins(), outline: smallZero, jack: false, uartExtra: null, usbCount: 1,
    ports: [
      R('hdmi', 'mini HDMI', 80, 245, 110, 70), R('usb', 'USB (data)', 380, 255, 80, 55), R('pwr', 'Power', 505, 255, 80, 55),
      R('csi', 'Camera', 600, 90, 55, 120), R('sd', 'microSD', -15, 90, 45, 110),
    ],
  }));
})();
