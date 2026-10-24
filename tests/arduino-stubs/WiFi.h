// Stand-in for the ESP32 WiFi library (syntax checks only).
#pragma once
#include "Arduino.h"
enum { WL_CONNECTED = 3, WIFI_STA = 1 };
class WiFiClass { public: int status() { return 0; } void mode(int) {} void begin(const char *, const char *) {} };
extern WiFiClass WiFi;
class WiFiClient {};
