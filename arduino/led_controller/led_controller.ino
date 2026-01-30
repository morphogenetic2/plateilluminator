/*
 * LED Controller for Adafruit Feather M4 Express
 * Controls 24-channel TLC5947 LED driver with programmable steps
 *
 * Ported from CircuitPython to Arduino C for improved performance
 *
 * Required Libraries:
 * - Adafruit_TLC5947
 * - ArduinoJson (v6.x)
 * - Adafruit_SPIFlash
 * - SdFat
 * - Adafruit_TinyUSB (for USB Mass Storage)
 */

#include <Adafruit_SPIFlash.h>
#include <Adafruit_TLC5947.h>
#include <Adafruit_TinyUSB.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <SdFat.h>

#include "config.h"
#include "led_program.h"
#include "utils.h"

// ==========================================
// Global Objects
// ==========================================

// Flash Storage (declared first for USB callbacks)
Adafruit_FlashTransport_QSPI flashTransport;
Adafruit_SPIFlash flash(&flashTransport);
FatFileSystem fatfs;

// ==========================================
// USB Mass Storage Configuration
// ==========================================

// USB Mass Storage object
Adafruit_USBD_MSC usb_msc;

// Callback invoked when received READ10 command.
// Copy disk's data to buffer (up to bufsize) and return number of copied bytes.
int32_t msc_read_cb(uint32_t lba, void *buffer, uint32_t bufsize) {
  return flash.readBlocks(lba, (uint8_t *)buffer, bufsize / 512) ? bufsize : -1;
}

// Callback invoked when received WRITE10 command.
// Process data in buffer to disk's storage and return number of written bytes
int32_t msc_write_cb(uint32_t lba, uint8_t *buffer, uint32_t bufsize) {
  return flash.writeBlocks(lba, buffer, bufsize / 512) ? bufsize : -1;
}

// Callback invoked when WRITE10 command is completed (status received and
// accepted by host). Used to flush any pending cache.
void msc_flush_cb(void) {
  flash.syncBlocks();
  // Clear file system's cache to force reload
  fatfs.cacheClear();
}

// ==========================================
// Other Global Objects
// ==========================================

// TLC5947 LED Driver
Adafruit_TLC5947 tlc = Adafruit_TLC5947(1, SCK, MOSI, TLC_LATCH_PIN);

// LED Programs (one per channel)
LEDProgram *ledPrograms[NUM_CHANNELS];

// Calibration data
float calibration[NUM_CHANNELS];

// Timing
unsigned int TICK_MS = DEFAULT_TICK_MS;
unsigned long lastUpdate = 0;

// Global experiment duration
float totalDurationMinutes = 0.0f;
unsigned long experimentStartTime = 0;
bool experimentFinished = false;

// ==========================================
// Setup
// ==========================================

void setup() {
  // Initialize Serial
  if (DEBUG_SERIAL) {
    Serial.begin(SERIAL_BAUD);
    while (!Serial && millis() < 3000)
      ; // Wait up to 3 seconds for Serial
    Serial.println("\n=== LED Controller Starting ===");
  }

  // Initialize TLC5947
  tlc.begin();
  Serial.println("TLC5947 initialized.");

  // Turn off all LEDs initially
  for (int i = 0; i < NUM_CHANNELS; i++) {
    tlc.setPWM(i, 0);
  }
  tlc.write();

  // Initialize Flash Storage
  if (!flash.begin()) {
    Serial.println("ERROR: Failed to initialize flash!");
    while (1)
      delay(1);
  }
  Serial.println("Flash initialized.");

  // Set up USB Mass Storage
  usb_msc.setID("Adafruit", "Feather M4", "1.0");
  usb_msc.setReadWriteCallback(msc_read_cb, msc_write_cb, msc_flush_cb);
  usb_msc.setCapacity(flash.size() / 512, 512);
  usb_msc.setUnitReady(true);
  usb_msc.begin();
  Serial.println("USB Mass Storage initialized.");

  if (!fatfs.begin(&flash)) {
    Serial.println("ERROR: Failed to mount filesystem!");
    while (1)
      delay(1);
  }
  Serial.println("Filesystem mounted.");

  // Load calibration
  loadCalibration(fatfs, calibration);

  // Load program
  DynamicJsonDocument programDoc(16384); // 16KB should be enough
  if (!loadProgram(fatfs, programDoc)) {
    Serial.println("ERROR: Failed to load program. Halting.");
    while (1)
      delay(1);
  }

  // Print program info
  printProgramInfo(programDoc);

  // Get global duration
  totalDurationMinutes = programDoc["total_duration_minutes"] | 0.0f;

  // Calculate dynamic TICK_MS
  TICK_MS = calculateDynamicTick(programDoc);

  // Initialize LED programs
  for (int i = 0; i < NUM_CHANNELS; i++) {
    String ledKey = "LED" + String(i);
    JsonArray steps = programDoc[ledKey];

    if (steps.isNull()) {
      // Create empty program
      DynamicJsonDocument emptyDoc(32);
      JsonArray emptyArray = emptyDoc.to<JsonArray>();
      ledPrograms[i] = new LEDProgram(emptyArray, i);
    } else {
      ledPrograms[i] = new LEDProgram(steps, i);
    }
  }

  Serial.println("LED programs initialized.");
  Serial.println("=== Setup Complete ===\n");

  // Record experiment start time
  experimentStartTime = millis();
}

// ==========================================
// Main Loop
// ==========================================

void loop() {
  unsigned long now = millis();
  unsigned long elapsed = now - lastUpdate;

  // Update at TICK_MS intervals
  if (elapsed >= TICK_MS) {
    lastUpdate = now;

    // Start timing the update cycle
    unsigned long updateStart = micros();

    // Check global timeout
    if (!experimentFinished && totalDurationMinutes > 0) {
      unsigned long totalElapsedMs = now - experimentStartTime;
      unsigned long timeoutMs =
          (unsigned long)(totalDurationMinutes * 60.0f * 1000.0f);

      if (totalElapsedMs >= timeoutMs) {
        Serial.println("Global experiment time reached. Turning off all LEDs.");
        experimentFinished = true;
      }
    }

    // Update all LED programs
    for (int i = 0; i < NUM_CHANNELS; i++) {
      float intensity;

      if (experimentFinished) {
        intensity = 0.0f;
      } else {
        // BUGFIX: Pass actual elapsed time, not target TICK_MS
        intensity = ledPrograms[i]->update(elapsed);
      }

      uint16_t pwm = uwCm2ToPwm(intensity, i, calibration);
      tlc.setPWM(i, pwm);
    }

    // Write all PWM values to hardware
    tlc.write();

    // Calculate update cycle time
    unsigned long updateTime = micros() - updateStart;

    // Print timing stats every 5 seconds
    static unsigned long lastPrint = 0;
    if (now - lastPrint >= 5000) {
      lastPrint = now;
      Serial.print("Update cycle: ");
      Serial.print(updateTime / 1000.0f, 2);
      Serial.print(" ms | Target TICK: ");
      Serial.print(TICK_MS);
      Serial.print(" ms | Actual interval: ");
      Serial.print(elapsed);
      Serial.println(" ms");
    }
  }
}
