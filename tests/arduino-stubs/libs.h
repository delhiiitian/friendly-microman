#pragma once
#include "Arduino.h"
#include "Wire.h"
// Library stubs with the method names from each library's documentation.
class SCD4x { public: bool begin(); bool readMeasurement(); uint16_t getCO2(); float getTemperature(); float getHumidity(); };
class SCD30 { public: bool begin(); bool dataAvailable(); uint16_t getCO2(); float getTemperature(); float getHumidity(); };
class Adafruit_SGP30 { public: bool begin(); bool IAQmeasure(); uint16_t eCO2, TVOC; };
class Adafruit_BME280 { public: bool begin(uint8_t); float readTemperature(); float readHumidity(); float readPressure(); };
enum { DHT11 = 11, DHT22 = 22 };
class DHT { public: DHT(uint8_t, uint8_t); void begin(); float readTemperature(); float readHumidity(); };
class OneWire { public: OneWire(uint8_t); };
#define DEVICE_DISCONNECTED_C -127
class DallasTemperature { public: DallasTemperature(OneWire *); void begin(); void requestTemperatures(); float getTempCByIndex(uint8_t); };
struct sensors_vec_t { float x, y, z; };
struct sensors_event_t { sensors_vec_t acceleration, gyro; float temperature; };
class Adafruit_MPU6050 { public: bool begin(uint8_t); bool getEvent(sensors_event_t *, sensors_event_t *, sensors_event_t *); };
class BH1750 { public: BH1750(uint8_t); bool begin(); float readLightLevel(); };
enum { SSD1306_SWITCHCAPVCC = 2, SSD1306_WHITE = 1 };
class Adafruit_SSD1306 { public: Adafruit_SSD1306(int, int, TwoWire *, int); bool begin(int, uint8_t); void clearDisplay(); void setTextColor(int); void setTextSize(int); void setCursor(int, int); void print(const String &); void display(); };
class LiquidCrystal_I2C { public: LiquidCrystal_I2C(uint8_t, uint8_t, uint8_t); void init(); void backlight(); void clear(); void print(const String &); void setCursor(int, int); };
class TM1637Display { public: TM1637Display(int, int); void setBrightness(int); void showNumberDec(int); };
class Servo { public: void attach(int); void write(int); };
enum { NEO_GRB = 0x52, NEO_KHZ800 = 0 };
class Adafruit_NeoPixel { public: Adafruit_NeoPixel(int, int, int); void begin(); void setBrightness(int); void fill(uint32_t); uint32_t Color(uint8_t, uint8_t, uint8_t); void show(); };
class Stepper { public: Stepper(int, int, int, int, int); void setSpeed(long); void step(int); };
class SoftwareSerial : public Stream { public: SoftwareSerial(int, int); };
