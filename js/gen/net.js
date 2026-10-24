/* Built-in outputs that are not a part on the board: a live graph, MQTT and Telegram.
   Each language gets the same three, written in its own style. The generators call
   FM.netAction() for an action whose uid is 'plot', 'mqtt' or 'telegram'. */
(function () {
  const NET_OUTPUTS = ['plot', 'mqtt', 'telegram'];
  FM.NET_OUTPUTS = NET_OUTPUTS;

  // Which boards can reach the network from the generated code.
  FM.hasNetwork = (board, lang) => board.family === 'pi' || board.family === 'esp32' || board.family === 'esp8266' || (board.family === 'pico' && lang === 'micropython');

  FM.netDefaults = () => ({ ssid: '', pass: '', broker: 'test.mosquitto.org', port: 1883, token: '', chat: '' });
  const net = (prog) => Object.assign(FM.netDefaults(), prog.net || {});
  const cStr = (s) => JSON.stringify(String(s));
  const topicOf = (a) => a.topic || 'friendly-microman/readings';

  // ---------- Python 3 on a Raspberry Pi ----------
  function python(a, A, prog, t) {
    const n = net(prog);
    if (a.uid === 'plot') {
      t.helper('def plot(values):\n    """Print name:value pairs. The Serial monitor tab in friendly-microman draws them as a graph."""\n    print(" ".join("%s:%s" % (k, x) for k, x in values.items() if isinstance(x, (int, float)) and not isinstance(x, bool)))');
      return { label: 'Draw a live graph', code: 'plot(v)' };
    }
    if (a.uid === 'mqtt') {
      t.imports.add('import json'); t.imports.add('import paho.mqtt.client as mqtt');
      t.libs.add('py-paho');
      t.setting('MQTT_BROKER = ' + FM.pyStr(n.broker) + '   # an MQTT server; test.mosquitto.org is public, so anyone can read it');
      t.setting('MQTT_PORT = ' + (+n.port || 1883));
      t.helper('_mqtt = None\n\n\ndef mqtt_send(topic, values):\n    """Publish the values as JSON. Reconnects on the next try if the network drops."""\n    global _mqtt\n    try:\n        if _mqtt is None:\n            _mqtt = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)\n            _mqtt.connect(MQTT_BROKER, MQTT_PORT)\n            _mqtt.loop_start()\n        _mqtt.publish(topic, json.dumps(values))\n    except OSError as e:\n        print("MQTT failed:", e)\n        _mqtt = None');
      return { label: 'Send to MQTT topic ' + topicOf(a), code: 'mqtt_send(' + FM.pyStr(topicOf(a)) + ', v)' };
    }
    if (a.uid === 'telegram') {
      t.imports.add('import urllib.parse'); t.imports.add('import urllib.request');
      t.setting('TELEGRAM_TOKEN = ' + FM.pyStr(n.token) + '   # from @BotFather in Telegram');
      t.setting('TELEGRAM_CHAT = ' + FM.pyStr(n.chat) + '   # your chat id; message @userinfobot to find it');
      t.helper('def telegram_send(text):\n    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT:\n        print("Telegram: put your bot token and chat id in the settings at the top")\n        return\n    data = urllib.parse.urlencode({"chat_id": TELEGRAM_CHAT, "text": text}).encode()\n    try:\n        urllib.request.urlopen("https://api.telegram.org/bot" + TELEGRAM_TOKEN + "/sendMessage", data, timeout=10).close()\n    except OSError as e:\n        print("Telegram failed:", e)');
      return { label: 'Send a Telegram message', code: 'telegram_send(msg)', msg: true };
    }
    return null;
  }

  // ---------- MicroPython (Pico W, ESP32, ESP8266) ----------
  function micropython(a, A, prog, t) {
    const n = net(prog);
    if (a.uid === 'plot') {
      t.helper('def plot(values):\n    # name:value pairs; the Serial monitor tab draws them as a graph\n    print(" ".join("%s:%s" % (k, x) for k, x in values.items() if isinstance(x, (int, float)) and not isinstance(x, bool)))');
      return { label: 'Draw a live graph', code: 'plot(v)' };
    }
    const wifi = () => {
      t.imports.add('import network');
      t.setting('WIFI_NAME = ' + FM.pyStr(n.ssid));
      t.setting('WIFI_PASSWORD = ' + FM.pyStr(n.pass));
      t.helper('def wifi():\n    """Join the Wi-Fi network once, then reuse it."""\n    w = network.WLAN(network.STA_IF)\n    if not w.isconnected():\n        w.active(True)\n        w.connect(WIFI_NAME, WIFI_PASSWORD)\n        for _ in range(30):\n            if w.isconnected():\n                break\n            time.sleep(0.5)\n    if not w.isconnected():\n        print("No Wi-Fi. Check WIFI_NAME and WIFI_PASSWORD.")\n    return w.isconnected()');
    };
    if (a.uid === 'mqtt') {
      wifi();
      t.imports.add('import json'); t.imports.add('from umqtt.simple import MQTTClient');
      t.libs.add('mip-umqtt');
      t.setting('MQTT_BROKER = ' + FM.pyStr(n.broker) + '   # test.mosquitto.org is public, so anyone can read it');
      t.setting('MQTT_PORT = ' + (+n.port || 1883));
      t.helper('_mqtt = None\n\n\ndef mqtt_send(topic, values):\n    global _mqtt\n    if not wifi():\n        return\n    try:\n        if _mqtt is None:\n            _mqtt = MQTTClient("fm-%d" % time.ticks_ms(), MQTT_BROKER, MQTT_PORT)\n            _mqtt.connect()\n        _mqtt.publish(topic, json.dumps(values))\n    except OSError as e:\n        print("MQTT failed:", e)\n        _mqtt = None');
      return { label: 'Send to MQTT topic ' + topicOf(a), code: 'mqtt_send(' + FM.pyStr(topicOf(a)) + ', v)' };
    }
    if (a.uid === 'telegram') {
      wifi();
      t.imports.add('import requests');
      if (A.board.family === 'esp8266') t.libs.add('mip-requests');
      t.setting('TELEGRAM_TOKEN = ' + FM.pyStr(n.token) + '   # from @BotFather in Telegram');
      t.setting('TELEGRAM_CHAT = ' + FM.pyStr(n.chat) + '   # your chat id; message @userinfobot to find it');
      t.helper('def telegram_send(text):\n    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT:\n        print("Telegram: put your bot token and chat id in the settings at the top")\n        return\n    if not wifi():\n        return\n    try:\n        r = requests.post("https://api.telegram.org/bot" + TELEGRAM_TOKEN + "/sendMessage", json={"chat_id": TELEGRAM_CHAT, "text": text})\n        r.close()\n    except OSError as e:\n        print("Telegram failed:", e)');
      return { label: 'Send a Telegram message', code: 'telegram_send(msg)', msg: true };
    }
    return null;
  }

  // ---------- Arduino C++ (ESP32 and ESP8266 for the network ones) ----------
  // t: { incs, decls, funcs, libs, names } where names are the program's values.
  function arduino(a, A, prog, t) {
    const n = net(prog);
    const esp32 = A.board.family === 'esp32';
    const add = (arr, s) => { if (!arr.includes(s)) arr.push(s); };
    if (a.uid === 'plot') {
      add(t.funcs, 'void plotValue(const char *name, float x) {  // name:value pairs for a graph\n  if (isnan(x)) return;\n  Serial.print(name);\n  Serial.print(\':\');\n  Serial.print(x);\n  Serial.print(\' \');\n}');
      const lines = t.names.filter((m) => !m.text).map((m) => 'plotValue(' + cStr(m.name) + ', v_' + m.name + ');');
      return { label: 'Draw a live graph (also works in the Arduino Serial Plotter)', code: lines.concat(['Serial.println();']).join('\n') };
    }
    const wifi = () => {
      add(t.incs, esp32 ? '#include <WiFi.h>' : '#include <ESP8266WiFi.h>');
      add(t.decls, 'const char *WIFI_NAME = ' + cStr(n.ssid) + ';\nconst char *WIFI_PASSWORD = ' + cStr(n.pass) + ';');
      add(t.funcs, 'bool wifiOk() {  // join the Wi-Fi network once, then reuse it\n  if (WiFi.status() == WL_CONNECTED) return true;\n  WiFi.mode(WIFI_STA);\n  WiFi.begin(WIFI_NAME, WIFI_PASSWORD);\n  for (int i = 0; i < 30 && WiFi.status() != WL_CONNECTED; i++) delay(500);\n  if (WiFi.status() != WL_CONNECTED) Serial.println(F("No Wi-Fi. Check WIFI_NAME and WIFI_PASSWORD."));\n  return WiFi.status() == WL_CONNECTED;\n}');
    };
    if (a.uid === 'mqtt') {
      wifi();
      add(t.incs, '#include <PubSubClient.h>');
      t.libs.add('ard-pubsub');
      add(t.decls, 'const char *MQTT_BROKER = ' + cStr(n.broker) + ';  // test.mosquitto.org is public, so anyone can read it\nconst int MQTT_PORT = ' + (+n.port || 1883) + ';\nWiFiClient netClient;\nPubSubClient mqtt(netClient);');
      add(t.funcs, 'String jv(float x) { return isnan(x) ? String("null") : String(x, 2); }\n\nvoid mqttSend(const char *topic, const String &payload) {\n  if (!wifiOk()) return;\n  if (!mqtt.connected()) {\n    mqtt.setServer(MQTT_BROKER, MQTT_PORT);\n    if (!mqtt.connect(("fm-" + String(millis())).c_str())) { Serial.println(F("MQTT failed")); return; }\n  }\n  mqtt.loop();\n  mqtt.publish(topic, payload.c_str());\n}');
      const vals = t.names.filter((m) => !m.text);
      const json = vals.length ? 'String("{")' + vals.map((m, k) => ' + ' + cStr((k ? ',' : '') + '"' + m.name + '":') + ' + jv(v_' + m.name + ')').join('') + ' + "}"' : 'String("{}")';
      return { label: 'Send to MQTT topic ' + topicOf(a), code: 'mqttSend(' + cStr(topicOf(a)) + ', ' + json + ');' };
    }
    if (a.uid === 'telegram') {
      wifi();
      add(t.incs, '#include <WiFiClientSecure.h>');
      add(t.incs, esp32 ? '#include <HTTPClient.h>' : '#include <ESP8266HTTPClient.h>');
      add(t.decls, 'const char *TELEGRAM_TOKEN = ' + cStr(n.token) + ';  // from @BotFather in Telegram\nconst char *TELEGRAM_CHAT = ' + cStr(n.chat) + ';  // your chat id; message @userinfobot to find it');
      add(t.funcs, 'String urlEncode(const String &s) {\n  const char *hex = "0123456789ABCDEF";\n  String out;\n  for (unsigned i = 0; i < s.length(); i++) {\n    char c = s[i];\n    if (isalnum((unsigned char)c) || c == \'-\' || c == \'_\' || c == \'.\') out += c;\n    else { out += \'%\'; out += hex[(c >> 4) & 15]; out += hex[c & 15]; }\n  }\n  return out;\n}\n\nvoid telegramSend(const String &text) {\n  if (!strlen(TELEGRAM_TOKEN) || !strlen(TELEGRAM_CHAT)) { Serial.println(F("Telegram: put your bot token and chat id at the top")); return; }\n  if (!wifiOk()) return;\n  WiFiClientSecure tls;\n  tls.setInsecure();  // skips the certificate check to keep this short\n  HTTPClient http;\n  http.begin(tls, String("https://api.telegram.org/bot") + TELEGRAM_TOKEN + "/sendMessage");\n  http.addHeader("Content-Type", "application/x-www-form-urlencoded");\n  int code = http.POST("chat_id=" + String(TELEGRAM_CHAT) + "&text=" + urlEncode(text));\n  if (code != 200) { Serial.print(F("Telegram failed: ")); Serial.println(code); }\n  http.end();\n}');
      return { label: 'Send a Telegram message', code: 'telegramSend(msg);', msg: true };
    }
    return null;
  }

  FM.netAction = function (lang, a, A, prog, t) {
    return { python, micropython, arduino }[lang](a, A, prog, t);
  };
})();
