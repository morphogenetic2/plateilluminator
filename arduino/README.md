# Arduino LED Controller

Arduino C port of the CircuitPython LED controller for Adafruit Feather M4 Express.

## Features

- ✅ **10-100x faster** than CircuitPython
- ✅ Sub-5ms tick intervals for smooth animations
- ✅ **USB Mass Storage** - Flash appears as USB drive for easy file updates
- ✅ **Drag-and-drop JSON files** while code runs (no reflashing needed!)
- ✅ Same JSON format (compatible with webapp)
- ✅ Uses internal 2MB QSPI flash storage
- ✅ Dynamic tick calculation based on program complexity
- ✅ Accurate SINE/RAMP timing (bugfix applied)

## Hardware Requirements

- **Adafruit Feather M4 Express** (ATSAMD51, 120 MHz)
- **TLC5947 24-channel LED driver**
- **Connections:**
  - TLC5947 LATCH → Feather D5
  - TLC5947 CLK → Feather SCK
  - TLC5947 DATA → Feather MOSI

## Required Libraries

Install via Arduino Library Manager:

1. **Adafruit_TLC5947** - LED driver control
2. **ArduinoJson** (v6.x) - JSON parsing
3. **Adafruit_SPIFlash** - Flash storage access
4. **SdFat** - FAT filesystem for flash

## Installation Steps

### 1. Install Arduino IDE

Download and install [Arduino IDE 2.x](https://www.arduino.cc/en/software)

### 2. Add Adafruit Board Support

1. Open Arduino IDE
2. Go to `File → Preferences`
3. Add this URL to "Additional Board Manager URLs":

   ```
   https://adafruit.github.io/arduino-board-index/package_adafruit_index.json
   ```

4. Go to `Tools → Board → Boards Manager`
5. Search "Adafruit SAMD"
6. Install "Adafruit SAMD Boards"

### 3. Install Required Libraries

1. Go to `Tools → Manage Libraries`
2. Install:
   - `Adafruit_TLC5947`
   - `ArduinoJson` (v6.x)
   - `Adafruit_SPIFlash`
   - `SdFat - Adafruit Fork`

### 4. Upload JSON Files to Flash

**The Easy Way (USB Mass Storage):**

Once you upload the Arduino sketch, the Feather M4 will appear as a USB drive on your computer. Simply:

1. Upload the sketch (see step 5)
2. Wait for the drive to appear (labeled "Feather M4")
3. Drag `program.json` and `calibration.json` to the drive
4. Press the reset button on the Feather
5. Done! The new program loads automatically

**Alternative (via CircuitPython):**

If you prefer, you can also copy files using CircuitPython before uploading the Arduino sketch:

1. Download CircuitPython `.uf2` for Feather M4 Express
2. Double-tap reset button → `FEATHERBOOT` drive appears
3. Drag `.uf2` file to drive
4. Wait for `CIRCUITPY` drive to appear
5. Copy `program.json` and `calibration.json` to the drive
6. Continue to step 5

### 5. Upload Arduino Sketch

1. Open `led_controller.ino` in Arduino IDE
2. Select board: `Tools → Board → Adafruit SAMD → Adafruit Feather M4 Express`
3. Select port: `Tools → Port → [Your COM port]`
4. Click **Upload** button (→)
5. Wait for compilation and upload (~15 seconds)
6. Open Serial Monitor (`Tools → Serial Monitor`, 115200 baud)
7. You should see startup messages

## File Structure

```
arduino/
└── led_controller/
    ├── led_controller.ino    # Main sketch
    ├── config.h              # Constants and pin definitions
    ├── led_program.h         # LEDProgram class header
    ├── led_program.cpp       # LEDProgram implementation
    ├── utils.h               # Utility functions header
    └── utils.cpp             # Utility functions implementation
```

## Configuration

Edit `config.h` to change:

- `NUM_CHANNELS` - Number of LED channels (default: 24)
- `TLC_LATCH_PIN` - Latch pin for TLC5947 (default: 5)
- `DEFAULT_TICK_MS` - Default update interval (default: 50ms)
- `MIN_TICK_MS` - Minimum tick interval (default: 5ms)
- `DEBUG_SERIAL` - Enable/disable serial debug output

## JSON File Format

Same format as CircuitPython version:

**program.json:**

```json
{
  "total_duration_minutes": 60,
  "LED0": [
    {"type": "SINE", "duration_ms": 5000, "int0": 100, "int1": 800, "freq": 5.0}
  ],
  "LED1": [
    {"type": "ON", "duration_ms": 1000, "int": 500},
    {"type": "OFF", "duration_ms": 1000}
  ]
}
```

**calibration.json:**

```json
{
  "0": 1.0,
  "1": 0.95,
  "2": 1.05
}
```

## Troubleshooting

### "Failed to initialize flash"

- Make sure you're using Feather M4 **Express** (has QSPI flash)
- Check that Adafruit_SPIFlash library is installed

### "Failed to load program.json"

- Verify JSON files are on the flash storage
- Use CircuitPython to copy files first (easiest method)
- Check Serial Monitor for detailed error messages

### LEDs not responding

- Verify TLC5947 wiring (LATCH, CLK, DATA)
- Check power supply to TLC5947
- Open Serial Monitor to see debug output

### Compilation errors

- Make sure all required libraries are installed
- Verify board is set to "Adafruit Feather M4 Express"
- Check that all `.h` and `.cpp` files are in the same folder as `.ino`

## Performance

Expected performance improvements over CircuitPython:

| Metric | CircuitPython | Arduino C |
|--------|---------------|-----------|
| **Tick Interval** | ~50ms (1 anim LED) | ~5ms (1 anim LED) |
| **Max SINE Freq** | ~20 Hz | >100 Hz |
| **CPU Usage** | ~80% | ~10% |
| **Timing Accuracy** | ±5ms | ±1ms |

## Switching Back to CircuitPython

1. Download CircuitPython `.uf2` for Feather M4 Express
2. Double-tap reset button
3. Drag `.uf2` to `FEATHERBOOT` drive
4. Copy `code.py` back to `CIRCUITPY` drive

## License

Same as original CircuitPython version.
