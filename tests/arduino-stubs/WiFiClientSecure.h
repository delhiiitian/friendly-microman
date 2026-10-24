// Stand-in for WiFiClientSecure (syntax checks only).
#pragma once
#include "WiFi.h"
class WiFiClientSecure : public WiFiClient { public: void setInsecure() {} };
