// Stand-in for the ESP32 HTTPClient (syntax checks only).
#pragma once
#include "WiFi.h"
class HTTPClient {
 public:
  bool begin(WiFiClient &, const String &) { return true; }
  void addHeader(const String &, const String &) {}
  int POST(const String &) { return 200; }
  void end() {}
};
