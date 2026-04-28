/**
 * Scan & Go — ESP32 RFID Gate Controller
 *
 * Hardware required:
 *   - ESP32 development board (e.g. ESP32-WROOM-32)
 *   - MFRC522 RFID reader module
 *   - Servo motor or relay module (for gate/lock)
 *   - Optional: LED indicators (green/red), buzzer
 *
 * Wiring (MFRC522 → ESP32):
 *   SDA  → GPIO 5  (SS)
 *   SCK  → GPIO 18
 *   MOSI → GPIO 23
 *   MISO → GPIO 19
 *   RST  → GPIO 22
 *   3.3V → 3.3V
 *   GND  → GND
 *
 * Libraries required (install via Arduino Library Manager):
 *   - MFRC522 by GithubCommunity
 *   - ArduinoJson by Benoit Blanchon
 *   - ESP32Servo (if using servo)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>

// ── Pin definitions ──────────────────────────────────────────────────────────
#define SS_PIN    5
#define RST_PIN   22
#define GREEN_LED 2
#define RED_LED   4
#define BUZZER    15
#define GATE_PIN  13   // Relay or servo signal pin

// ── Configuration — update these ────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Point to your FastAPI service or Supabase Edge Function
// FastAPI:          "http://192.168.1.100:8000/check-payment"
// Supabase Edge Fn: "https://your-project.supabase.co/functions/v1/rfid-gate-check"
const char* BACKEND_URL   = "http://YOUR_SERVER_IP:8000/check-payment";

// If using Supabase Edge Function, set your anon key here
const char* SUPABASE_ANON_KEY = "";   // leave empty if using FastAPI

// Gate open duration in milliseconds
const int GATE_OPEN_MS = 3000;

// ── Globals ──────────────────────────────────────────────────────────────────
MFRC522 rfid(SS_PIN, RST_PIN);

// ── Setup ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  pinMode(GATE_PIN, OUTPUT);

  // Start with gate closed
  digitalWrite(GATE_PIN, LOW);
  digitalWrite(RED_LED, HIGH);

  // Connect to WiFi
  Serial.printf("Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nConnected. IP: %s\n", WiFi.localIP().toString().c_str());

  // Init RFID reader
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("RFID reader ready. Waiting for tags...");
}

// ── Main loop ────────────────────────────────────────────────────────────────
void loop() {
  // Wait for a new card
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  String rfidTag = getRFIDTag();
  Serial.printf("Tag detected: %s\n", rfidTag.c_str());

  bool paid = checkPayment(rfidTag);

  if (paid) {
    Serial.println("✅ Payment verified — opening gate");
    openGate();
  } else {
    Serial.println("❌ Not paid — access denied");
    denyAccess();
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  delay(1000);  // debounce
}

// ── Read RFID tag as uppercase hex string ────────────────────────────────────
String getRFIDTag() {
  String tag = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) tag += "0";
    tag += String(rfid.uid.uidByte[i], HEX);
  }
  tag.toUpperCase();
  return tag;
}

// ── Call backend to check if RFID tag is paid ────────────────────────────────
bool checkPayment(String rfidTag) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected — denying access");
    return false;
  }

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");

  // Add Supabase auth header if using Edge Function
  if (strlen(SUPABASE_ANON_KEY) > 0) {
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
    http.addHeader("apikey", SUPABASE_ANON_KEY);
  }

  // Build JSON body
  // FastAPI endpoint expects: {"rfid_id": "AABBCCDD"}
  // Supabase Edge Function expects: {"rfid_ids": ["AABBCCDD"]}
  String body;
  if (strlen(SUPABASE_ANON_KEY) > 0) {
    body = "{\"rfid_ids\":[\"" + rfidTag + "\"]}";
  } else {
    body = "{\"rfid_id\":\"" + rfidTag + "\"}";
  }

  int statusCode = http.POST(body);

  if (statusCode != 200) {
    Serial.printf("Backend error: HTTP %d\n", statusCode);
    http.end();
    return false;
  }

  String response = http.getString();
  http.end();

  // Parse response
  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, response);
  if (err) {
    Serial.printf("JSON parse error: %s\n", err.c_str());
    return false;
  }

  // FastAPI returns: {"paid": true/false}
  // Edge Function returns: {"allowed": true/false, ...}
  if (doc.containsKey("paid")) {
    return doc["paid"].as<bool>();
  }
  if (doc.containsKey("allowed")) {
    return doc["allowed"].as<bool>();
  }

  return false;
}

// ── Open gate for GATE_OPEN_MS milliseconds ──────────────────────────────────
void openGate() {
  digitalWrite(GREEN_LED, HIGH);
  digitalWrite(RED_LED, LOW);
  tone(BUZZER, 1000, 200);   // short beep

  digitalWrite(GATE_PIN, HIGH);  // energize relay / move servo
  delay(GATE_OPEN_MS);
  digitalWrite(GATE_PIN, LOW);   // close gate

  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, HIGH);
}

// ── Deny access ──────────────────────────────────────────────────────────────
void denyAccess() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(RED_LED, LOW);
    tone(BUZZER, 400, 150);
    delay(200);
    digitalWrite(RED_LED, HIGH);
    delay(200);
  }
}
