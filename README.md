# friendly-microman

A visual workbench for people starting with Raspberry Pi and microcontrollers.
Pick your parts, get the wiring, build a program from boxes, try it with virtual
parts, then send the real code to your board.

- **Parts gallery.** 35 common sensors and modules (CO₂, temperature, gyro, distance, motion, light, soil,
  displays, LEDs, buzzer, speaker, servo, relay, camera…), each with a picture.
- **Automatic wiring.** Pins are chosen so nothing clashes: sensors share one I2C bus, clashing I2C
  addresses move to the alternate address, power and ground come from the nearest pins, and 5 V signals on
  3.3 V boards are flagged. A Raspberry Pi gets an ADS1115 added for you when you use an analog sensor.
- **What each part can do.** Select a part to see the values you can read (for a gyro: x, y, z…) and the things
  you can make it do (show text, say something, beep, move to an angle…).
- **Program from boxes.** Read → Change (maths, smoothing, °C→°F, a limit check) → Do (print, show on a screen,
  speak, beep, light an LED, move a servo, save to CSV…). Messages use names like `x axis is {x}`.
  There is also a command listener mode: typed or spoken commands with your own rules.
- **Try it without hardware.** Every part works as a virtual part. Sensors become sliders (or drift, or go up
  and down), and outputs become a virtual OLED, LCD, LED, buzzer, speaker (your browser talks), servo dial and terminal.
- **Live graphs.** "Draw a live graph" plots every value, in the simulator and in the Serial monitor while the real
  board runs (it prints `name:value` lines, which the Arduino IDE's Serial Plotter also understands).
- **Alerts over the network.** Send readings to MQTT (Home Assistant, Node-RED…) or a Telegram message to your phone,
  from a Pi, a Pico W, an ESP32 or an ESP8266. Wi-Fi details go in the block; the code joins the network itself.
- **Wiring checker.** Tell it where each wire really goes. It marks every wire right, works (different pin, the code
  can follow your wiring), careful, wrong (SDA/SCL swapped, TX/RX not crossed, pin already used) or stop (power the
  wrong way round, 5 V on a 3.3 V part, a signal on a power pin).
- **Guided lessons.** Six short lessons (blink an LED, read a temperature, CO₂ alarm, gyro x axis, make the Pi talk,
  graph and share) with a coach that ticks each step by itself.
- **Save and share.** Keep projects in the browser, share them as a link or a short code, or as a project file.
  Share codes leave out your Wi-Fi password and Telegram token, and a shared project is checked field by field
  before it is opened.
- **Real code, always visible.** Python 3 for Raspberry Pi, MicroPython for Pico/ESP32/ESP8266, and Arduino C++.
  Edit it freely; the blocks stop overwriting it until you ask.
- **Libraries.** Each part knows its library (pip, MicroPython `mip`, Arduino Library Manager). The Libraries tab
  lists what the program needs and installs it through the helper.
- **Upload.** In Chrome or Edge the page can connect to a USB board, guess which board it is, show its output,
  and save `main.py` straight onto a MicroPython board. Arduino compile and upload go through the helper.

## Boards

Raspberry Pi 5, Pi 4 / 400, Pi 3 / 2, Pi Zero 2 W / Zero W, Raspberry Pi Pico / Pico W / Pico 2,
ESP32 DevKit (30-pin), ESP8266 NodeMCU, Arduino Uno / Nano. Each is one file in `js/boards/`;
see [docs/ADDING.md](docs/ADDING.md) to add more boards or parts.

## Run it

Just open `index.html` in a browser to plan, simulate and read code.

For uploading, library installs and running programs on a Pi, start the helper (Python 3, no extra packages needed):

```sh
python3 helper/fm_helper.py
# then open http://localhost:8765 in Chrome or Edge
```

The helper uses these tools when they are installed:

| Tool | For | Install |
| --- | --- | --- |
| [arduino-cli](https://arduino.github.io/arduino-cli/latest/installation/) | Compiling and uploading Arduino sketches, Arduino libraries | see link |
| mpremote | MicroPython uploads and `mip` libraries | `pip install mpremote` |
| pyserial | Better USB port names | `pip install pyserial` |

On a Raspberry Pi, run the helper on the Pi and open the page there. "Run on this Pi" saves the program to
`~/friendly-microman/program.py`, runs it inside `~/fm-env` (created on first use), and streams the output.
To use a Pi from another computer, start it with `--host 0.0.0.0` (trusted networks only) and open
`http://<pi-name>.local:8765`.

The helper listens on this computer only by default, checks the Host and Origin of every request, and needs a
token that only pages it serves can read, so other websites cannot use it.

## Tests

```sh
node tests/generate.test.js   # every starter project and part, on every board and language
node tests/upload.test.js     # the MicroPython raw-REPL upload, replayed in real Python
node tests/projects.test.js   # share codes round-trip; crafted projects cannot inject code
node tests/wiring.test.js     # the wiring checker on every board
node tests/lessons.test.js    # every lesson can be finished
```
`npm test` runs them all.

The generator test compiles all Python and MicroPython output with `python3 -m py_compile` and checks all Arduino
output with `g++ -fsyntax-only` against small stand-ins for the Arduino core and libraries (`tests/arduino-stubs`).
It cannot catch a wrong library call on a real board, so treat first runs on hardware as the real test.

## Layout

```
index.html            the app
css/app.css
js/core.js            registries and helpers
js/boards/*.js        board profiles (pins, buses, ports, USB ids)
js/parts.js           parts catalog (signals, values, actions, libraries, picture)
js/libraries.js       library catalog for the Library Manager
js/allocate.js        pin planner
js/gen/*.js           code generators (python, micropython, arduino)
js/templates.js       starter projects
js/program.js         program helpers shared by UI, simulator and tests
js/gen/net.js         graph, MQTT and Telegram outputs for every language
js/projects.js        save, share codes, project files
js/wirecheck.js       wiring checker
js/lessons.js         guided lessons
js/chart.js           live graphs
js/sim.js             simulator with virtual parts
js/serial.js          Web Serial + MicroPython upload
js/helper-client.js   talks to the local helper
helper/fm_helper.py   local helper
```
