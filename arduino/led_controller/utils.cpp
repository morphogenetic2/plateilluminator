// utils.cpp - Utility functions implementation
#include "utils.h"
#include "config.h"

uint16_t uwCm2ToPwm(float uwCm2, int ledIndex, float calibration[]) {
  float calibFactor = calibration[ledIndex];
  int pwm = (int)(uwCm2 * calibFactor * PWM_CONVERSION_FACTOR);
  return constrain(pwm, 0, MAX_PWM_VALUE);
}

bool loadCalibration(FatFileSystem &fatfs, float calibration[]) {
  File file = fatfs.open(CALIBRATION_FILE, FILE_READ);

  if (!file) {
    Serial.println("No calibration.json found. Using default calibration (1.0 "
                   "for all LEDs).");
    for (int i = 0; i < NUM_CHANNELS; i++) {
      calibration[i] = 1.0f;
    }
    return false;
  }

  // Parse JSON
  DynamicJsonDocument doc(2048);
  DeserializationError error = deserializeJson(doc, file);
  file.close();

  if (error) {
    Serial.print("Failed to parse calibration.json: ");
    Serial.println(error.c_str());
    // Use defaults
    for (int i = 0; i < NUM_CHANNELS; i++) {
      calibration[i] = 1.0f;
    }
    return false;
  }

  // Load calibration values
  for (int i = 0; i < NUM_CHANNELS; i++) {
    String key = String(i);
    calibration[i] = doc[key] | 1.0f;
  }

  Serial.println("Calibration loaded successfully.");
  return true;
}

bool loadProgram(FatFileSystem &fatfs, DynamicJsonDocument &doc) {
  File file = fatfs.open(PROGRAM_FILE, FILE_READ);

  if (!file) {
    Serial.println("ERROR: program.json not found!");
    return false;
  }

  DeserializationError error = deserializeJson(doc, file);
  file.close();

  if (error) {
    Serial.print("ERROR: Failed to parse program.json: ");
    Serial.println(error.c_str());
    return false;
  }

  Serial.println("Program loaded successfully.");
  return true;
}

unsigned int calculateDynamicTick(DynamicJsonDocument &doc) {
  unsigned long minDuration = 0xFFFFFFFF;
  int animationLedCount = 0;

  // Scan all LED programs
  for (int i = 0; i < NUM_CHANNELS; i++) {
    String ledKey = "LED" + String(i);
    JsonArray steps = doc[ledKey];

    if (!steps.isNull()) {
      for (JsonObject step : steps) {
        unsigned long dur = step["duration_ms"] | 0;
        String type = step["type"] | "OFF";

        if (dur > 0) {
          minDuration = min(minDuration, dur);
        }

        if (type == STEP_TYPE_RAMP || type == STEP_TYPE_SINE) {
          animationLedCount++;
          break; // Count each LED only once
        }
      }
    }
  }

  unsigned int tickMs;

  if (animationLedCount > 0) {
    // Calculate based on number of animation LEDs
    // ~1.75ms per LED for SPI update, minimum 5ms floor
    int calculated = (int)ceil(1.75f * animationLedCount);
    tickMs = max(MIN_TICK_MS, calculated);
    Serial.print("Dynamic TICK: Found ");
    Serial.print(animationLedCount);
    Serial.print(" LEDs with RAMP/SINE. Setting TICK_MS = ");
    Serial.println(tickMs);
  } else if (minDuration != 0xFFFFFFFF) {
    // Static program: use step duration as tick (min 50ms for stability)
    tickMs = max(50, (int)minDuration);
    Serial.print("Dynamic TICK: Static program. Setting TICK_MS = ");
    Serial.println(tickMs);
  } else {
    tickMs = DEFAULT_TICK_MS;
    Serial.print("Dynamic TICK: Defaulting to ");
    Serial.println(tickMs);
  }

  return tickMs;
}

void printProgramInfo(DynamicJsonDocument &doc) {
  Serial.println("\n=== Program Info ===");

  float totalDuration = doc["total_duration_minutes"] | 0.0f;
  Serial.print("Total Duration: ");
  if (totalDuration > 0) {
    Serial.print(totalDuration);
    Serial.println(" minutes");
  } else {
    Serial.println("Infinite (no time limit)");
  }

  int activeLeds = 0;
  for (int i = 0; i < NUM_CHANNELS; i++) {
    String ledKey = "LED" + String(i);
    JsonArray steps = doc[ledKey];
    if (!steps.isNull() && steps.size() > 0) {
      activeLeds++;
    }
  }

  Serial.print("Active LEDs: ");
  Serial.print(activeLeds);
  Serial.print(" / ");
  Serial.println(NUM_CHANNELS);
  Serial.println("====================\n");
}
