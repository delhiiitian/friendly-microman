/* Library catalog used by the Library Manager. kind decides the installer:
   pip -> pip install (Pi), apt -> sudo apt install (Pi), mip -> mpremote mip install (MicroPython),
   arduino -> arduino-cli lib install. Parts point at these ids in their `libs` field. */
(function () {
  const L = FM.registerLibrary;
  // Raspberry Pi (Python 3)
  L({ id: 'gpiozero', kind: 'pip', pkg: 'gpiozero', name: 'gpiozero', desc: 'Simple control of LEDs, buttons, buzzers, servos and more. Comes with Raspberry Pi OS.', preinstalled: true });
  L({ id: 'blinka', kind: 'pip', pkg: 'adafruit-blinka', name: 'Adafruit Blinka', desc: 'Lets Adafruit CircuitPython sensor drivers run on a Pi.' });
  L({ id: 'py-scd4x', kind: 'pip', pkg: 'adafruit-circuitpython-scd4x', name: 'SCD4x driver', desc: 'Sensirion SCD40/SCD41 CO₂ sensors.' });
  L({ id: 'py-scd30', kind: 'pip', pkg: 'adafruit-circuitpython-scd30', name: 'SCD30 driver', desc: 'Sensirion SCD30 CO₂ sensor.' });
  L({ id: 'py-sgp30', kind: 'pip', pkg: 'adafruit-circuitpython-sgp30', name: 'SGP30 driver', desc: 'eCO₂ and TVOC gas sensor.' });
  L({ id: 'py-bme280', kind: 'pip', pkg: 'adafruit-circuitpython-bme280', name: 'BME280 driver', desc: 'Temperature, humidity and pressure.' });
  L({ id: 'py-dht', kind: 'pip', pkg: 'adafruit-circuitpython-dht', name: 'DHT driver', desc: 'DHT11 and DHT22 sensors.' });
  L({ id: 'py-mpu6050', kind: 'pip', pkg: 'adafruit-circuitpython-mpu6050', name: 'MPU6050 driver', desc: 'Gyro and accelerometer.' });
  L({ id: 'py-bh1750', kind: 'pip', pkg: 'adafruit-circuitpython-bh1750', name: 'BH1750 driver', desc: 'Light meter in lux.' });
  L({ id: 'py-ssd1306', kind: 'pip', pkg: 'adafruit-circuitpython-ssd1306', name: 'SSD1306 OLED driver', desc: 'Small monochrome OLED screens.' });
  L({ id: 'pillow', kind: 'pip', pkg: 'pillow', name: 'Pillow', desc: 'Draws text and images for screens.' });
  L({ id: 'rplcd', kind: 'pip', pkg: 'RPLCD smbus2', name: 'RPLCD', desc: 'Character LCDs with an I2C backpack.' });
  L({ id: 'py-tm1637', kind: 'pip', pkg: 'raspberrypi-tm1637', name: 'TM1637 driver', desc: '4-digit 7-segment displays.' });
  L({ id: 'py-neopixel', kind: 'pip', pkg: 'adafruit-circuitpython-neopixel', name: 'NeoPixel driver', desc: 'WS2812 LED strips. On a Pi 5 also install adafruit-blinka-raspberry-pi5-neopixel.' });
  L({ id: 'py-ads1x15', kind: 'pip', pkg: 'adafruit-circuitpython-ads1x15<3', name: 'ADS1x15 driver', desc: 'ADS1115 analog input board.' });
  L({ id: 'pyserial', kind: 'pip', pkg: 'pyserial', name: 'pySerial', desc: 'Talks to serial (UART) devices.' });
  L({ id: 'vosk', kind: 'pip', pkg: 'vosk sounddevice', name: 'Vosk speech recognition', desc: 'Offline voice commands. Downloads a small English model the first time.' });
  L({ id: 'portaudio', kind: 'apt', pkg: 'libportaudio2', name: 'PortAudio', desc: 'Microphone access for sounddevice.' });
  L({ id: 'espeak', kind: 'apt', pkg: 'espeak-ng', name: 'eSpeak NG', desc: 'Text to speech: makes the Pi talk.' });
  L({ id: 'py-paho', kind: 'pip', pkg: 'paho-mqtt>=2', name: 'Paho MQTT', desc: 'Sends readings to an MQTT server (Home Assistant, Node-RED, dashboards).' });
  L({ id: 'picamera2', kind: 'apt', pkg: 'python3-picamera2', name: 'Picamera2', desc: 'Camera Module photos and video. Comes with Raspberry Pi OS.', preinstalled: true });

  // MicroPython (installed onto the board with mpremote mip)
  L({ id: 'mip-ssd1306', kind: 'mip', pkg: 'ssd1306', name: 'ssd1306', desc: 'OLED driver from micropython-lib.' });
  L({ id: 'mip-tm1637', kind: 'mip', pkg: 'github:mcauser/micropython-tm1637', name: 'micropython-tm1637', desc: '4-digit display driver.' });
  L({ id: 'mip-umqtt', kind: 'mip', pkg: 'umqtt.simple', name: 'umqtt.simple', desc: 'Small MQTT client from micropython-lib.' });
  L({ id: 'mip-requests', kind: 'mip', pkg: 'requests', name: 'requests', desc: 'HTTP requests, for Telegram messages. Already built into ESP32 and Pico W firmware.' });

  // Arduino (arduino-cli lib install "<name>")
  L({ id: 'ard-scd4x', kind: 'arduino', pkg: 'SparkFun SCD4x Arduino Library', name: 'SparkFun SCD4x', desc: 'SCD40/SCD41 CO₂ sensors.' });
  L({ id: 'ard-scd30', kind: 'arduino', pkg: 'SparkFun SCD30 Arduino Library', name: 'SparkFun SCD30', desc: 'SCD30 CO₂ sensor.' });
  L({ id: 'ard-sgp30', kind: 'arduino', pkg: 'Adafruit SGP30 Sensor', name: 'Adafruit SGP30', desc: 'eCO₂ and TVOC.' });
  L({ id: 'ard-bme280', kind: 'arduino', pkg: 'Adafruit BME280 Library', name: 'Adafruit BME280', desc: 'Weather sensor (installs Adafruit Unified Sensor too).' });
  L({ id: 'ard-dht', kind: 'arduino', pkg: 'DHT sensor library', name: 'DHT sensor library', desc: 'DHT11 and DHT22.' });
  L({ id: 'ard-onewire', kind: 'arduino', pkg: 'OneWire', name: 'OneWire', desc: '1-Wire bus.' });
  L({ id: 'ard-dallas', kind: 'arduino', pkg: 'DallasTemperature', name: 'DallasTemperature', desc: 'DS18B20 probes.' });
  L({ id: 'ard-mpu6050', kind: 'arduino', pkg: 'Adafruit MPU6050', name: 'Adafruit MPU6050', desc: 'Gyro and accelerometer.' });
  L({ id: 'ard-bh1750', kind: 'arduino', pkg: 'BH1750', name: 'BH1750', desc: 'Light meter.' });
  L({ id: 'ard-ssd1306', kind: 'arduino', pkg: 'Adafruit SSD1306', name: 'Adafruit SSD1306', desc: 'OLED screens.' });
  L({ id: 'ard-gfx', kind: 'arduino', pkg: 'Adafruit GFX Library', name: 'Adafruit GFX', desc: 'Text and drawing for screens.' });
  L({ id: 'ard-lcd-i2c', kind: 'arduino', pkg: 'LiquidCrystal I2C', name: 'LiquidCrystal I2C', desc: '16×2 LCD with I2C backpack.' });
  L({ id: 'ard-tm1637', kind: 'arduino', pkg: 'TM1637', name: 'TM1637 (avishorp)', desc: '4-digit display.' });
  L({ id: 'ard-servo', kind: 'arduino', pkg: 'Servo', name: 'Servo', desc: 'Servo motors on AVR boards. ESP32 uses ESP32Servo instead.' });
  L({ id: 'ard-esp32servo', kind: 'arduino', pkg: 'ESP32Servo', name: 'ESP32Servo', desc: 'Servo motors on ESP32.' });
  L({ id: 'ard-pubsub', kind: 'arduino', pkg: 'PubSubClient', name: 'PubSubClient', desc: 'MQTT client for ESP32 and ESP8266.' });
  L({ id: 'ard-neopixel', kind: 'arduino', pkg: 'Adafruit NeoPixel', name: 'Adafruit NeoPixel', desc: 'WS2812 LED strips.' });
})();
