// led_program.h - LED Program step execution class
#ifndef LED_PROGRAM_H
#define LED_PROGRAM_H

#include <Arduino.h>
#include <ArduinoJson.h>

class LEDProgram {
public:
  // Constructor
  LEDProgram(JsonArray steps, int ledIndex);

  // Destructor
  ~LEDProgram();

  // Update LED state based on elapsed time
  // Returns current intensity in µW/cm²
  float update(unsigned long dtMs);

  // Reset program to beginning
  void reset();

private:
  struct Step {
    String type; // "ON", "OFF", "RAMP", "SINE"
    unsigned long durationMs;
    float intensity;  // For ON steps
    float int0, int1; // For RAMP and SINE steps
    float freq;       // For SINE steps (Hz)
  };

  Step *steps;                 // Array of steps
  int numSteps;                // Number of steps
  int ledIndex;                // LED index (0-23)
  int currentStepIndex;        // Current step being executed
  unsigned long elapsedInStep; // Time elapsed in current step (ms)
  float currentIntensity;      // Current intensity (µW/cm²)

  // Helper to parse step from JSON
  void parseStep(JsonObject stepObj, Step &step);
};

#endif // LED_PROGRAM_H
