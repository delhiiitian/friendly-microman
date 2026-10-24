// Minimal stand-in for the Arduino core so generated sketches can be syntax-checked with g++.
// It only declares what the generator uses; it is not a working Arduino.
#pragma once
#include <cmath>
#include <cstdint>
#include <cstring>
#include <string>
#include <algorithm>
#include <cctype>
using std::isnan; using std::round; using std::fabs; using std::min; using std::max;
typedef uint8_t byte;
enum { LOW = 0, HIGH = 1, INPUT = 0, OUTPUT = 1, INPUT_PULLUP = 2, SERIAL_8N1 = 0 };
enum { A0 = 14, A1, A2, A3, A4, A5, A6, A7 };
#define F(x) x
#ifndef NAN
#define NAN (0.0f/0.0f)
#endif
template <class T, class L, class H> T constrain(T x, L lo, H hi) { return x < lo ? lo : (x > hi ? hi : x); }
void pinMode(int, int); void digitalWrite(int, int); int digitalRead(int); int analogRead(int); void analogWrite(int, int);
void delay(unsigned long); void delayMicroseconds(unsigned int); unsigned long millis(); unsigned long pulseIn(int, int, unsigned long);
class String {
 public:
  std::string s;
  String() {}
  String(const char *c) : s(c) {}
  String(const std::string &c) : s(c) {}
  String(long v) : s(std::to_string(v)) {}
  String(unsigned long v) : s(std::to_string(v)) {}
  String(int v) : s(std::to_string(v)) {}
  String(float v, int d) : s(std::to_string(v)) { (void)d; }
  String operator+(const String &o) const { return String(s + o.s); }
  String operator+(const char *o) const { return String(s + o); }
  friend String operator+(const char *a, const String &b) { return String(std::string(a) + b.s); }
  String substring(unsigned a, unsigned b) const { return String(s.substr(a, b - a)); }
  unsigned length() const { return (unsigned)s.size(); }
  char operator[](unsigned i) const { return s[i]; }
  String &operator+=(char c) { s += c; return *this; }
  const char *c_str() const { return s.c_str(); }
  void toLowerCase() {} void trim() {}
  int indexOf(const char *x) const { auto p = s.find(x); return p == std::string::npos ? -1 : (int)p; }
};
class Stream {
 public:
  void begin(unsigned long) {}
  void begin(unsigned long, int, int, int) {}
  void setRX(int) {} void setTX(int) {}
  int available() { return 0; } int read() { return -1; }
  size_t write(const byte *, size_t n) { return n; }
  size_t readBytes(byte *, size_t n) { return n; }
  template <class T> void print(T) {} template <class T> void println(T) {} void println() {}
  String readStringUntil(char) { return String(); }
};
extern Stream Serial, Serial1, Serial2;
class TwoWire { public: void begin() {} };
