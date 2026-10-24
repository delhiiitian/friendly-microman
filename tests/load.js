// Loads the browser scripts into Node for tests (no DOM needed).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const FILES = ['js/core.js', 'js/boards/pi.js', 'js/boards/pico.js', 'js/boards/esp.js', 'js/boards/arduino.js',
  'js/parts.js', 'js/libraries.js', 'js/allocate.js', 'js/gen/common.js', 'js/gen/python.js', 'js/gen/micropython.js',
  'js/gen/arduino.js', 'js/templates.js', 'js/program.js'];
module.exports = function load() {
  const ctx = { window: {}, console };
  ctx.window = ctx;
  vm.createContext(ctx);
  FILES.forEach((f) => { if (fs.existsSync(path.join(ROOT, f))) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); });
  return ctx.FM;
};
