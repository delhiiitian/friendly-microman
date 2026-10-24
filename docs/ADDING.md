# Adding boards and parts

Everything the app knows about hardware is plain data, so most additions touch one or two files.

## A new board

Create `js/boards/<name>.js` and call `FM.registerBoard({...})`, then add a `<script>` line for it in
`index.html` (and in `tests/load.js`). Look at `js/boards/pico.js` for a short example. The important fields:

| Field | Meaning |
| --- | --- |
| `id`, `name`, `short`, `chip`, `blurb` | How the board is shown |
| `family` | `pi`, `pico`, `esp32`, `esp8266` or `arduino`. Picks the code language and library kinds |
| `logic` | Signal voltage, 3.3 or 5. Drives the level warnings |
| `pins` | `{ id: { label, type, gpio, fn } }`. `type` is one of `v5 v3 vin gnd gpio i2c spi uart pwm adc sys` |
| `layout` | `{ kind: 'paired' \| 'sides', left: [ids], right: [ids] }`, top to bottom as printed on the board |
| `bus` | Default pins for `i2c`, `spi`, `uart` (list), `i2s`, `w1` (1-Wire) and `ws` (LED strips) |
| `pwm` | List of PWM pin ids, or `'all'` |
| `adc` | `[{ pin, ch }]` analog inputs. Leave empty and an ADS1115 is added for analog parts |
| `gpioPool` | Pins in the order you would hand them out to a beginner |
| `power` | `{ v3: [ids], v5: [ids], gnd: [ids] }` |
| `avoid` | `{ id: 'reason' }` pins the planner must not use |
| `usbIds` | `[{ vid, note }]` USB vendor ids, used to guess the board when it is plugged in |
| `fqbn` | Arduino board id for arduino-cli, e.g. `arduino:avr:uno` |
| `outline`, `ports` | The simple board drawing |

If the new board belongs to a new family (say, an STM32 or a BBC micro:bit), also add it to `FM.FAMILY` in
`js/core.js` and teach one of the generators (or a new one in `js/gen/`) how to start its program.

## A new part

1. Add it to `js/parts.js` with `FM.registerPart({...})`:
   `sig` lists its pins and what each needs (`vcc`, `gnd`, `sda`, `scl`, `gpio`, `pwm`, `adc`, `tx`, `rx`, ...),
   `values` are the channels you can read, `actions` what it can do, `libs` the library ids per language, and
   `icon` picks a drawing in `js/icons.js`.
2. Add any new library to `js/libraries.js`.
3. Add a code snippet with the same id to each generator you want to support: `PY` in `js/gen/python.js`,
   `MP` in `js/gen/micropython.js`, `AR` in `js/gen/arduino.js`. Each snippet has `init`/`setup` code, a
   `read` body that returns or stores its values, and `acts` for each action.
4. Give it a virtual view in `js/sim.js` (`drawOutput`) and a sensible range in `RANGE` if it is a sensor.
5. Run `node tests/generate.test.js`. It generates code for your part on every board and checks it compiles.
