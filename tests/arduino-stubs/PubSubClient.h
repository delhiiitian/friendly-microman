// Stand-in for PubSubClient (syntax checks only).
#pragma once
#include "WiFi.h"
class PubSubClient {
 public:
  PubSubClient(WiFiClient &) {}
  bool connected() { return false; }
  void setServer(const char *, int) {}
  bool connect(const char *) { return true; }
  bool loop() { return true; }
  bool publish(const char *, const char *) { return true; }
};
