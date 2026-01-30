// led_program.cpp - LED Program step execution implementation
#include "led_program.h"
#include "config.h"
#include <math.h>

LEDProgram::LEDProgram(JsonArray stepsArray, int ledIdx) {
  ledIndex = ledIdx;
  numSteps = stepsArray.size();
  currentStepIndex = 0;
  elapsedInStep = 0;
  currentIntensity = 0.0f;

  // Allocate memory for steps
  if (numSteps > 0) {
    steps = new Step[numSteps];

    // Parse each step from JSON
    int i = 0;
    for (JsonObject stepObj : stepsArray) {
      parseStep(stepObj, steps[i]);
      i++;
    }
  } else {
    steps = nullptr;
  }
}

LEDProgram::~LEDProgram() {
  if (steps != nullptr) {
    delete[] steps;
  }
}

void LEDProgram::parseStep(JsonObject stepObj, Step &step) {
  step.type = stepObj["type"] | "OFF";
  step.durationMs = stepObj["duration_ms"] | 0;

  if (step.type == STEP_TYPE_ON) {
    step.intensity = stepObj["int"] | 0.0f;
  } else if (step.type == STEP_TYPE_RAMP) {
    step.int0 = stepObj["int0"] | 0.0f;
    step.int1 = stepObj["int1"] | 0.0f;
  } else if (step.type == STEP_TYPE_SINE) {
    step.int0 = stepObj["int0"] | 0.0f;
    step.int1 = stepObj["int1"] | 0.0f;
    step.freq = stepObj["freq"] | 1.0f;
  }
}

float LEDProgram::update(unsigned long dtMs) {
  // If no steps, return 0
  if (numSteps == 0 || steps == nullptr) {
    currentIntensity = 0.0f;
    return 0.0f;
  }

  // Update elapsed time in current step
  elapsedInStep += dtMs;

  Step &currentStep = steps[currentStepIndex];

  // Check if we need to move to next step
  if (elapsedInStep >= currentStep.durationMs) {
    currentStepIndex = (currentStepIndex + 1) % numSteps;
    elapsedInStep = 0;
    // Update reference to new current step
    currentStep = steps[currentStepIndex];
  }

  // Calculate intensity based on step type
  if (currentStep.type == STEP_TYPE_ON) {
    currentIntensity = currentStep.intensity;

  } else if (currentStep.type == STEP_TYPE_OFF) {
    currentIntensity = 0.0f;

  } else if (currentStep.type == STEP_TYPE_RAMP) {
    float fraction =
        min(1.0f, (float)elapsedInStep / (float)currentStep.durationMs);
    currentIntensity =
        currentStep.int0 + (currentStep.int1 - currentStep.int0) * fraction;

  } else if (currentStep.type == STEP_TYPE_SINE) {
    float amplitude = (currentStep.int1 - currentStep.int0) / 2.0f;
    float midpoint = (currentStep.int0 + currentStep.int1) / 2.0f;
    float t = elapsedInStep / 1000.0f; // Time in seconds
    currentIntensity =
        midpoint + amplitude * sin(2.0f * PI * currentStep.freq * t);
  }

  return currentIntensity;
}

void LEDProgram::reset() {
  currentStepIndex = 0;
  elapsedInStep = 0;
  currentIntensity = 0.0f;
}
