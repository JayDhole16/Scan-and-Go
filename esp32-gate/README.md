# ESP32 RFID Gate Controller

This sketch runs on an ESP32 and controls a physical gate/lock based on RFID payment status.

## Hardware

| Component | Purpose |
|-----------|---------|
| ESP32-WROOM-32 | Main microcontroller + WiFi |
| MFRC522 RFID reader | Reads RFID tags on products |
| Relay module (5V) | Controls gate lock/solenoid |
| Green LED | Access granted indicator |
| Red LED | Access denied / idle indicator |
| Buzzer | Audio feedback |

## Wiring

```
MFRC522 → ESP32
SDA     → GPIO 5
SCK     → GPIO 18
MOSI    → GPIO 23
MISO    → GPIO 19
RST     → GPIO 22
3.3V    → 3.3V
GND     → GND

Relay signal → GPIO 13
Green LED    → GPIO 2
Red LED      → GPIO 4
Buzzer       → GPIO 15
```

## Setup

1. Install [Arduino IDE](https://www.arduino.cc/en/software) or use PlatformIO
2. Add ESP32 board support: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
3. Install libraries via Library Manager:
   - `MFRC522` by GithubCommunity
   - `ArduinoJson` by Benoit Blanchon
4. Open `main.ino`
5. Update the config section at the top:
   ```cpp
   const char* WIFI_SSID     = "your_wifi";
   const char* WIFI_PASSWORD = "your_password";
   const char* BACKEND_URL   = "http://YOUR_SERVER_IP:8000/check-payment";
   ```
6. Flash to ESP32

## Backend Options

The ESP32 can talk to either:

**Option A — FastAPI service** (simpler, local network):
```cpp
const char* BACKEND_URL = "http://192.168.1.100:8000/check-payment";
// Leave SUPABASE_ANON_KEY empty
```

**Option B — Supabase Edge Function** (cloud, no local server needed):
```cpp
const char* BACKEND_URL = "https://your-project.supabase.co/functions/v1/rfid-gate-check";
const char* SUPABASE_ANON_KEY = "your_anon_key";
```

## How It Works

1. ESP32 boots and connects to WiFi
2. MFRC522 continuously polls for RFID cards
3. When a card is detected, its UID is read as a hex string (e.g. `A1B2C3D4`)
4. ESP32 sends a POST request to the backend with the RFID tag
5. Backend checks if the product with that `rfid_id` has `is_paid = true`
6. If paid → relay opens gate for 3 seconds, green LED on, short beep
7. If not paid → red LED flashes, 3 error beeps, gate stays closed
