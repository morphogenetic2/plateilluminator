// config.h - Configuration and constants for LED Controller
#ifndef CONFIG_H
#define CONFIG_H

// Hardware Configuration
#define NUM_CHANNELS 24 // Number of TLC5947 channels (24 LEDs)
#define TLC_LATCH_PIN 5 // Latch pin for TLC5947 (same as CircuitPython D5)

// Timing Configuration
#define DEFAULT_TICK_MS 50 // Default update period (ms)
#define MIN_TICK_MS 2      // Minimum tick interval (ms)
#define MAX_TICK_MS 1000   // Maximum tick interval (ms)

// Calibration
#define PWM_CONVERSION_FACTOR 2.8833333f // µW/cm² to PWM conversion factor
#define MAX_PWM_VALUE 4095               // 12-bit PWM maximum

// File paths on flash storage
#define PROGRAM_FILE "/program.json"
#define CALIBRATION_FILE "/calibration.json"

// Step Types (matching CircuitPython)
#define STEP_TYPE_ON "ON"
#define STEP_TYPE_OFF "OFF"
#define STEP_TYPE_RAMP "RAMP"
#define STEP_TYPE_SINE "SINE"

// Debug
#define DEBUG_SERIAL true // Enable serial debug output
#define SERIAL_BAUD 115200

#endif // CONFIG_H
