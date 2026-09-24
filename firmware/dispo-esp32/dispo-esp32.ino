#include <WiFi.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>

#define DEVICE_NAME "EZConnect-Min"

static const char *SVC_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
static const char *RX_UUID  = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";
static const char *TX_UUID  = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";

// ─── Slot / Relay Configuration ──────────────────────────────────
const uint8_t MAX_SLOTS = 4;
const uint8_t SLOT_PINS[MAX_SLOTS] = {12, 13, 14, 15};
const uint32_t RELAY_PULSE_MS = 500;   // momentary "button press" duration

// Most relay boards are active-LOW (a LOW signal energizes the coil).
// Flip these two if your hardware is active-HIGH instead.
static const uint8_t RELAY_ACTIVE_LEVEL = LOW;
static const uint8_t RELAY_IDLE_LEVEL   = HIGH;

// ─── MongoDB / Backend Configuration ──────────────────────────────
static const char *SERVER_BASE_URL = "https://vending-server.vercel.app";
static const uint32_t TELEMETRY_INTERVAL_MS = 30000; // heartbeat cadence
static const uint32_t ORDER_POLL_INTERVAL_MS = 3000;  // how often we ask "anything to dispense?"
static const uint32_t DISPENSE_SETTLE_MS = 800;       // gap between back-to-back pulses so the mechanism resets
static const uint32_t ORDER_MAX_DURATION_MS = 60000;  // give up and report /fail if a single order runs longer than this

Preferences prefs;

static portMUX_TYPE payloadMux = portMUX_INITIALIZER_UNLOCKED;
static volatile bool havePayload = false;
static String payload = "";

static BLECharacteristic *txChar = nullptr;

static String g_deviceId = ""; // cached copy of the NVS-stored device id (this IS the qrToken)

// ─── Relay State (thread-safe via portMUX) ───────────────────────
struct RelayState {
  bool pulseActive;
  uint32_t pulseEndAt;
};
static RelayState relayState[MAX_SLOTS];
static portMUX_TYPE relayMux = portMUX_INITIALIZER_UNLOCKED;

// ─── Pending-Order Dispense State ─────────────────────────────────
// One order at a time, matching /api/devices/by-token/:token/pending-orders,
// which deliberately hands back only the single oldest pending order. A
// multi-unit line item (qty > 1) dispenses as that many separate pulses on
// the same slot, one after another with a settle gap between them.
struct OrderItem {
  uint8_t slotNumber;
  uint8_t qty;
};
static bool orderActive = false;
static String orderId = "";
static OrderItem orderItems[MAX_SLOTS]; // an order can't reference more distinct slots than the board has
static uint8_t orderItemCount = 0;
static uint8_t orderItemIdx = 0;
static uint8_t orderUnitIdx = 0;
static uint32_t orderSettleUntil = 0;
static uint32_t orderStartedAt = 0; // millis() when this order became active — backstop for ORDER_MAX_DURATION_MS

// Result of the last /pending-orders poll, handed from the background HTTP
// task to loop() the same way `payload` is handed from the BLE callback.
static portMUX_TYPE orderPollMux = portMUX_INITIALIZER_UNLOCKED;
static volatile bool havePendingOrderResult = false;
static volatile bool orderPollInFlight = false;
static String pendingOrderJson = "";

// ─── Forward Declarations ────────────────────────────────────────
static void notifyStatus(const String &msg);
static bool triggerSlot(uint8_t idx);
static void sendJsonPostAsync(const String &path, const String &body);
static uint32_t getEpochTime();
static void pollPendingOrders();
static void checkPendingOrderResult();
static void driveOrderInProgress();
static void checkOrderTimeout();
static void advanceOrderProgress();
static void patchUrlAsync(const String &url, const String &body);
static void completeOrderAsync(const String &completedOrderId);
static void reportProgressAsync(const String &forOrderId, uint8_t slotNumber);
static void failOrderAsync(const String &forOrderId, const String &reason);

// ─── Bluetooth Callbacks ─────────────────────────────────────────
class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) override {
    uint8_t *data = c->getData();
    size_t n = c->getLength();
    if (!n) return;

    Serial.printf("[ble ] received %u bytes: ", (unsigned)n);
    for (size_t i = 0; i < n; i++) {
      Serial.print((char)(data[i] >= 32 && data[i] < 127 ? data[i] : '.'));
    }
    Serial.println();

    portENTER_CRITICAL(&payloadMux);
    for (size_t i = 0; i < n; i++) {
      payload += (char)data[i];
    }
    havePayload = true;
    portEXIT_CRITICAL(&payloadMux);
  }
};

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *s) override {
    Serial.println("[ble ] phone connected — advertising stopped");
  }
  void onDisconnect(BLEServer *s) override {
    Serial.println("[ble ] phone disconnected — restarting advertising");
    delay(300);
    BLEDevice::startAdvertising();
  }
};

// ─── Send a status line back over BLE, safely ────────────────────
static void notifyStatus(const String &msg) {
  if (!txChar) return;
  txChar->setValue(msg.c_str());
  txChar->notify();
  Serial.printf("[ble ] notified: %s\n", msg.c_str());
}

// ─── WiFi Reporting ──────────────────────────────────────────────
static void onWiFiEvent(WiFiEvent_t event, WiFiEventInfo_t info) {
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_CONNECTED:
      Serial.println("[wifi] associated with access point");
      break;
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      Serial.print("[wifi] CONNECTED, IP: ");
      Serial.print(WiFi.localIP());
      Serial.printf(", RSSI: %d dBm\n", WiFi.RSSI());
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED: {
      uint8_t r = info.wifi_sta_disconnected.reason;
      const char *why = r == 15  ? "wrong password"
                      : r == 201 ? "network not found (or 5GHz only)"
                      : r == 205 ? "access point dropped connection" : "other";
      Serial.printf("[wifi] disconnected, reason %u — %s\n", r, why);
      break;
    }
    default: break;
  }
}

static void connectWiFi(const String &ssid, const String &pass) {
  notifyStatus("CONNECTING");

  Serial.printf("[wifi] WiFi.begin(\"%s\", <%u char password>)\n", ssid.c_str(), pass.length());
  WiFi.disconnect(true, false);
  delay(150);
  WiFi.begin(ssid.c_str(), pass.length() ? pass.c_str() : nullptr);

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    Serial.print('.');
    delay(500);
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] joined in %lu ms\n", millis() - start);
    notifyStatus("CONNECTED," + WiFi.localIP().toString());
    // Kick off NTP sync so /logs and /telemetry timestamps are real epoch time.
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  } else {
    Serial.println("[wifi] connection timeout (20s)");
    notifyStatus("FAILED");
  }
}

// ─── Credentials Handling ────────────────────────────────────────
static void handleDeviceId(String token) {
  token.trim();
  if (!token.length()) {
    Serial.println("[dvi ] rejected — empty token");
    notifyStatus("DEVICEID_FAILED");
    return;
  }

  Serial.printf("[dvi ] setting device ID: \"%s\"\n", token.c_str());

  prefs.begin("device", false);
  prefs.putString("id", token);
  prefs.end();

  // Read it back to actually confirm the write stuck, rather than just
  // assuming putString() succeeded.
  prefs.begin("device", true);
  String stored = prefs.getString("id", "");
  prefs.end();

  if (stored == token) {
    g_deviceId = stored;
    Serial.println("[dvi ] saved to Flash memory");
    notifyStatus("DEVICEID_SET");
  } else {
    Serial.println("[dvi ] verification failed after write");
    notifyStatus("DEVICEID_FAILED");
  }
}

static void handleSlotCommand(String numStr) {
  numStr.trim();

  bool numeric = numStr.length() > 0;
  for (size_t i = 0; i < numStr.length() && numeric; i++) {
    if (!isDigit(numStr[i])) numeric = false;
  }
  int n = numeric ? numStr.toInt() : -1;

  if (n < 1 || n > MAX_SLOTS) {
    Serial.printf("[slot] invalid slot token \"%s\"\n", numStr.c_str());
    notifyStatus("INVALID_SLOT");
    return;
  }

  triggerSlot((uint8_t)(n - 1));
}

static void handlePayload(String text) {
  text.trim();
  Serial.printf("[cred] parsing: \"%s\"\n", text.c_str());

  if (text.startsWith("dvi_")) {
    handleDeviceId(text.substring(4));
    return;
  }

  if (text.startsWith("slot_")) {
    handleSlotCommand(text.substring(5));
    return;
  }

  int comma = text.indexOf(',');
  if (comma <= 0) {
    Serial.println("[cred] rejected — expected format: ssid,password");
    return;
  }

  String ssid = text.substring(0, comma);
  String pass = text.substring(comma + 1);
  Serial.printf("[cred] ssid \"%s\", password length: %u\n", ssid.c_str(), pass.length());

  prefs.begin("wifi", false);
  prefs.putString("ssid", ssid);
  prefs.putString("pass", pass);
  prefs.end();
  Serial.println("[nvs ] saved to Flash memory");

  connectWiFi(ssid, pass);
}

// ─── Relay Control (non-blocking, portMUX-protected) ─────────────
static inline void relayWrite(uint8_t idx, bool on) {
  digitalWrite(SLOT_PINS[idx], on ? RELAY_ACTIVE_LEVEL : RELAY_IDLE_LEVEL);
}

static bool triggerSlot(uint8_t idx) {
  if (idx >= MAX_SLOTS) return false;

  bool started = false;
  portENTER_CRITICAL(&relayMux);
  if (!relayState[idx].pulseActive) {
    relayState[idx].pulseActive = true;
    relayState[idx].pulseEndAt = millis() + RELAY_PULSE_MS;
    started = true;
  }
  portEXIT_CRITICAL(&relayMux);

  if (started) {
    relayWrite(idx, true);
    notifyStatus("SLOT_" + String(idx + 1) + "_ACTIVE");
    Serial.printf("[slot] %u activated for %lu ms\n", idx + 1, (unsigned long)RELAY_PULSE_MS);
  } else {
    Serial.printf("[slot] %u busy, ignoring trigger\n", idx + 1);
  }
  return started;
}

static void logSlotExecution(uint8_t slotNumber) {
  JsonDocument doc;
  doc["deviceId"] = g_deviceId.length() ? g_deviceId : "unprovisioned";
  doc["slotNumber"] = slotNumber;
  doc["status"] = "COMPLETED";
  doc["timestamp"] = getEpochTime();
  doc["rssi"] = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0;

  String body;
  serializeJson(doc, body);
  sendJsonPostAsync("/logs", body);
}

// Called every loop() iteration — turns off any relay whose pulse window
// has elapsed and fires the completion notification + cloud log. If that
// pulse belonged to the order currently being dispensed, also advances the
// order's state machine to the next unit/item (or completes the order).
static void serviceRelays() {
  uint32_t now = millis();
  for (uint8_t i = 0; i < MAX_SLOTS; i++) {
    bool finished = false;
    portENTER_CRITICAL(&relayMux);
    if (relayState[i].pulseActive && (int32_t)(now - relayState[i].pulseEndAt) >= 0) {
      relayState[i].pulseActive = false;
      finished = true;
    }
    portEXIT_CRITICAL(&relayMux);

    if (finished) {
      relayWrite(i, false);
      uint8_t slotNumber = i + 1;
      notifyStatus("SLOT_" + String(slotNumber) + "_DONE");
      Serial.printf("[slot] %u pulse complete\n", slotNumber);
      logSlotExecution(slotNumber);

      if (orderActive && orderItems[orderItemIdx].slotNumber == slotNumber) {
        advanceOrderProgress();
      }
    }
  }
}

// ─── MongoDB / Backend HTTP Integration ──────────────────────────
static uint32_t getEpochTime() {
  time_t now = time(nullptr);
  // Before NTP sync, time(nullptr) returns a small number (seconds since boot
  // reference of 1970) — treat anything before ~2023 as "not yet synced".
  return now > 1700000000UL ? (uint32_t)now : 0;
}

struct HttpTaskParam {
  String url;
  String body;
};

static void httpPostTask(void *pv) {
  HttpTaskParam *p = static_cast<HttpTaskParam *>(pv);

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(p->url);
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(p->body);
    Serial.printf("[http] POST %s -> %d\n", p->url.c_str(), code);
    http.end();
  } else {
    Serial.printf("[http] skipped POST %s — WiFi not connected\n", p->url.c_str());
  }

  delete p;
  vTaskDelete(nullptr);
}

static void sendJsonPostAsync(const String &path, const String &body) {
  HttpTaskParam *p = new HttpTaskParam{String(SERVER_BASE_URL) + path, body};
  BaseType_t ok = xTaskCreate(httpPostTask, "httpPost", 8192, p, 1, nullptr);
  if (ok != pdPASS) {
    Serial.println("[http] failed to spawn POST task");
    delete p;
  }
}

// Fire-and-forget PATCH, same shape as the POST task above — used for every
// order-status callback (complete / progress / fail), none of which need a
// request body or a response back into loop().
static void httpPatchTask(void *pv) {
  HttpTaskParam *p = static_cast<HttpTaskParam *>(pv);

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(p->url);
    http.addHeader("Content-Type", "application/json");
    int code = http.PATCH(p->body);
    Serial.printf("[http] PATCH %s -> %d\n", p->url.c_str(), code);
    http.end();
  } else {
    Serial.printf("[http] skipped PATCH %s — WiFi not connected\n", p->url.c_str());
  }

  delete p;
  vTaskDelete(nullptr);
}

static void patchUrlAsync(const String &url, const String &body) {
  HttpTaskParam *p = new HttpTaskParam{url, body};
  BaseType_t ok = xTaskCreate(httpPatchTask, "httpPatch", 8192, p, 1, nullptr);
  if (ok != pdPASS) {
    Serial.println("[http] failed to spawn PATCH task");
    delete p;
  }
}

static void completeOrderAsync(const String &completedOrderId) {
  patchUrlAsync(String(SERVER_BASE_URL) + "/api/devices/by-token/" + g_deviceId + "/orders/" + completedOrderId + "/complete", "");
}

// Called after every individual unit dispensed (not just once at the end)
// so the server knows exactly how much of the order actually went out —
// that's what lets /fail restore only the undispensed portion later.
static void reportProgressAsync(const String &forOrderId, uint8_t slotNumber) {
  patchUrlAsync(String(SERVER_BASE_URL) + "/api/devices/by-token/" + g_deviceId +
                "/orders/" + forOrderId + "/items/" + String(slotNumber) + "/progress", "");
}

// Explicit "I couldn't finish this" report — the server's own timeout
// sweep would eventually catch a truly dead/unreachable board anyway, but
// reporting proactively means a recoverable problem (e.g. a jam we detect
// locally) gets the customer's stock restored in seconds, not minutes.
static void failOrderAsync(const String &forOrderId, const String &reason) {
  JsonDocument doc;
  doc["reason"] = reason;
  String body;
  serializeJson(doc, body);
  patchUrlAsync(String(SERVER_BASE_URL) + "/api/devices/by-token/" + g_deviceId + "/orders/" + forOrderId + "/fail", body);
}

static void sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) return;

  JsonDocument doc;
  doc["deviceId"] = g_deviceId.length() ? g_deviceId : "unprovisioned";
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["uptimeSeconds"] = millis() / 1000;
  doc["timestamp"] = getEpochTime();

  String body;
  serializeJson(doc, body);
  sendJsonPostAsync("/telemetry", body);
}

// ─── Order Polling & Dispensing ───────────────────────────────────
// GET runs in its own task (unlike the fire-and-forget POST/PATCH tasks,
// this one needs its response body back), and hands the raw JSON to
// loop() via the same copy-then-clear pattern used for BLE `payload`, so
// ArduinoJson parsing — not thread-safe — only ever happens on the main
// task.
static void pollPendingOrdersTask(void *pv) {
  String *urlPtr = static_cast<String *>(pv);
  String url = *urlPtr;
  delete urlPtr;

  String result = "{}";
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(url);
    int code = http.GET();
    if (code == 200) {
      result = http.getString();
    } else {
      Serial.printf("[ordr] poll GET -> %d\n", code);
    }
    http.end();
  }

  portENTER_CRITICAL(&orderPollMux);
  pendingOrderJson = result;
  havePendingOrderResult = true;
  portEXIT_CRITICAL(&orderPollMux);

  orderPollInFlight = false;
  vTaskDelete(nullptr);
}

static void pollPendingOrders() {
  if (orderPollInFlight) return; // previous poll hasn't finished yet — skip this tick
  orderPollInFlight = true;
  String *urlPtr = new String(String(SERVER_BASE_URL) + "/api/devices/by-token/" + g_deviceId + "/pending-orders");
  BaseType_t ok = xTaskCreate(pollPendingOrdersTask, "pollOrders", 8192, urlPtr, 1, nullptr);
  if (ok != pdPASS) {
    Serial.println("[ordr] failed to spawn poll task");
    delete urlPtr;
    orderPollInFlight = false;
  }
}

// Parses whatever the last poll came back with. {} (nothing pending) is
// the common case and is silently ignored.
static void checkPendingOrderResult() {
  if (!havePendingOrderResult) return;

  String json;
  portENTER_CRITICAL(&orderPollMux);
  json = pendingOrderJson;
  havePendingOrderResult = false;
  portEXIT_CRITICAL(&orderPollMux);

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, json);
  if (err) {
    Serial.printf("[ordr] bad pending-orders JSON: %s\n", err.c_str());
    return;
  }
  if (doc["orderId"].isNull()) return; // {} — nothing to dispense right now

  String newOrderId = doc["orderId"].as<String>();
  uint8_t count = 0;
  for (JsonObject item : doc["items"].as<JsonArray>()) {
    if (count >= MAX_SLOTS) break;
    int slot = item["slotNumber"] | 0;
    int qty = item["qty"] | 0;
    if (slot < 1 || slot > MAX_SLOTS || qty < 1) continue;
    orderItems[count++] = OrderItem{(uint8_t)slot, (uint8_t)qty};
  }
  if (count == 0) {
    Serial.printf("[ordr] order %s had no valid items — skipping\n", newOrderId.c_str());
    return;
  }

  orderId = newOrderId;
  orderItemCount = count;
  orderItemIdx = 0;
  orderUnitIdx = 0;
  orderSettleUntil = 0;
  orderStartedAt = millis();
  orderActive = true;
  Serial.printf("[ordr] order %s: %u line item(s) to dispense\n", orderId.c_str(), orderItemCount);
}

// Advances past one finished pulse: either the same slot needs another unit
// (qty > 1), or it's time for the next line item, or the whole order is done.
// Reports the unit that just finished before doing anything else, so a
// progress ping is never skipped even if something below short-circuits.
static void advanceOrderProgress() {
  reportProgressAsync(orderId, orderItems[orderItemIdx].slotNumber);

  orderUnitIdx++;
  if (orderUnitIdx < orderItems[orderItemIdx].qty) {
    orderSettleUntil = millis() + DISPENSE_SETTLE_MS;
    return;
  }

  orderItemIdx++;
  orderUnitIdx = 0;
  if (orderItemIdx < orderItemCount) {
    orderSettleUntil = millis() + DISPENSE_SETTLE_MS;
    return;
  }

  Serial.printf("[ordr] order %s fully dispensed\n", orderId.c_str());
  completeOrderAsync(orderId);
  orderActive = false;
}

// Backstop for a stuck order — e.g. a relay that never reports its pulse as
// finished for some hardware reason not otherwise caught. The server's own
// 5-minute timeout sweep is the ultimate safety net if this can't even
// reach the network, but reporting locally recovers much faster when it can.
static void checkOrderTimeout() {
  if (!orderActive) return;
  if (millis() - orderStartedAt < ORDER_MAX_DURATION_MS) return;

  Serial.printf("[ordr] order %s exceeded %lu ms — reporting failure\n", orderId.c_str(), (unsigned long)ORDER_MAX_DURATION_MS);
  failOrderAsync(orderId, "device_timeout");
  orderActive = false;
}

// Kicks off the next pulse for the order in progress, once the previous
// pulse's settle window has passed and that slot isn't already mid-pulse
// (e.g. from a stray manual BLE slot_ command).
static void driveOrderInProgress() {
  if (!orderActive) return;
  if (millis() < orderSettleUntil) return;

  uint8_t slotIdx = orderItems[orderItemIdx].slotNumber - 1;

  bool busy;
  portENTER_CRITICAL(&relayMux);
  busy = relayState[slotIdx].pulseActive;
  portEXIT_CRITICAL(&relayMux);
  if (busy) return;

  triggerSlot(slotIdx);
}

// ─── Setup & Loop ────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  uint32_t serialStart = millis();
  while (!Serial && (millis() - serialStart < 3000));

  delay(300);
  Serial.println("\n=================================================");
  Serial.printf ("  CafeESP Coffee Machine Controller | Free Heap: %u bytes\n", (unsigned)ESP.getFreeHeap());
  Serial.println("=================================================");

  // Safe pin init — every slot starts OFF before anything else can touch it.
  for (uint8_t i = 0; i < MAX_SLOTS; i++) {
    relayState[i].pulseActive = false;
    relayState[i].pulseEndAt = 0;
    pinMode(SLOT_PINS[i], OUTPUT);
    relayWrite(i, false);
  }

  WiFi.mode(WIFI_STA);
  WiFi.onEvent(onWiFiEvent);

  BLEDevice::init(DEVICE_NAME);
  BLEServer *bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());

  BLEService *svc = bleServer->createService(SVC_UUID);

  BLECharacteristic *rx = svc->createCharacteristic(
      RX_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  rx->setCallbacks(new RxCallbacks());

  txChar = svc->createCharacteristic(TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  txChar->addDescriptor(new BLE2902());

  svc->start();

  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SVC_UUID);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();

  Serial.printf("[ble ] advertising as \"%s\"\n", DEVICE_NAME);
  Serial.printf("[ble ] write \"ssid,password\", \"dvi_<id>\" or \"slot_<n>\" to %s\n", RX_UUID);
  Serial.printf("[ble ] status notifications on %s\n", TX_UUID);

  prefs.begin("wifi", true);
  String ssid = prefs.getString("ssid", "");
  String pass = prefs.getString("pass", "");
  prefs.end();

  prefs.begin("device", true);
  g_deviceId = prefs.getString("id", "");
  prefs.end();
  if (g_deviceId.length()) {
    Serial.printf("[dvi ] device ID on file: %s\n", g_deviceId.c_str());
  } else {
    Serial.println("[dvi ] no device ID stored yet — waiting for admin to provision this board");
  }

  if (ssid.length()) {
    Serial.printf("[nvs ] found saved network \"%s\"\n", ssid.c_str());
    connectWiFi(ssid, pass);
  } else {
    Serial.println("[nvs ] no credentials stored — listening over BLE");
  }
}

void loop() {
  static uint32_t settleAt = 0;

  if (havePayload) {
    if (!settleAt) settleAt = millis() + 400;
    if (millis() > settleAt) {
      String text;

      portENTER_CRITICAL(&payloadMux);
      text = payload;
      payload = "";
      havePayload = false;
      portEXIT_CRITICAL(&payloadMux);

      settleAt = 0;
      handlePayload(text);
    }
  }

  serviceRelays();
  driveOrderInProgress();
  checkPendingOrderResult();
  checkOrderTimeout();

  static uint32_t lastTelemetry = 0;
  if (millis() - lastTelemetry > TELEMETRY_INTERVAL_MS) {
    lastTelemetry = millis();
    sendTelemetry();
  }

  // Only ask for work when we're not already mid-dispense — the endpoint
  // hands back one order at a time on purpose, so there's nothing new to
  // fetch until the current one is finished and marked complete.
  static uint32_t lastOrderPoll = 0;
  if (!orderActive && g_deviceId.length() && WiFi.status() == WL_CONNECTED &&
      millis() - lastOrderPoll > ORDER_POLL_INTERVAL_MS) {
    lastOrderPoll = millis();
    pollPendingOrders();
  }

  static uint32_t lastHb = 0;
  if (millis() - lastHb > 10000) {
    lastHb = millis();
    Serial.printf("[ hb ] wifi: %s | free heap: %u\n",
                  WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString().c_str() : "not connected",
                  (unsigned)ESP.getFreeHeap());
  }

  delay(10);
}
