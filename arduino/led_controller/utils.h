// utils.h - Utility functions for LED controller
#ifndef UTILS_H
#define UTILS_H

#include <Adafruit_SPIFlash.h>
#include <Arduino.h>
#include <ArduinoJson.h>
#include <SdFat.h>


// Convert µW/cm² to 12-bit PWM value using calibration
uint16_t uwCm2ToPwm(float uwCm2, int ledIndex, float calibration[]);

// Load calibration data from flash
bool loadCalibration(FatFileSystem &fatfs, float calibration[]);

// Load program data from flash
bool loadProgram(FatFileSystem &fatfs, DynamicJsonDocument &doc);

// Calculate optimal TICK_MS based on program content
unsigned int calculateDynamicTick(DynamicJsonDocument &doc);

// Print program info to Serial (for debugging)
void printProgramInfo(DynamicJsonDocument &doc);

#endif // UTILS_H
