import time
import math
import json

import board
import busio
import digitalio
import adafruit_tlc5947

# -----------------------
# 1) TLC5947 Configuration
# -----------------------

SCK = board.SCK
MOSI = board.MOSI
LATCH_PIN = digitalio.DigitalInOut(board.D5)
LATCH_PIN.direction = digitalio.Direction.OUTPUT

# Create the SPI bus and TLC5947 object
spi = busio.SPI(clock=SCK, MOSI=MOSI)
tlc = adafruit_tlc5947.TLC5947(spi, LATCH_PIN)

# Number of channels in TLC5947
NUM_CHANNELS = 24

# ---------------
# 2) Calibration
# ---------------
calib_white = {
    0: 0.8534,
    1: 0.8391,
    2: 0.8992,
    3: 0.8465,
    4: 0.8491,
    5: 0.9214,
    6: 1.0000,
    7: 0.9603,
    8: 0.9167,
    9: 0.9050,
    10: 0.9005,
    11: 0.8930,
    12: 0.9453,
    13: 0.9203,
    14: 0.8780,
    15: 0.8512,
    16: 0.8784,
    17: 0.8751,
    18: 0.9058,
    19: 0.8673,
    20: 0.8210,
    21: 0.8628,
    22: 0.9637,
    23: 0.9264,
}

def uw_cm2_to_pwm(uw_cm2, led_index):
    """
    Convert from µW/cm² to 12-bit PWM using calibration.
    Then clamp to [0..4095].
    """
    calib_factor = calib_white.get(led_index, 1.0)
    raw = uw_cm2 * calib_factor * 2.8833333
    pwm_val_12bit = int(raw)
    return min(max(pwm_val_12bit, 0), 4095)


# -------------------------------
# 3) Data Structures / State Logic
# -------------------------------
class StepType:
    ON = "ON"
    OFF = "OFF"
    RAMP = "RAMP"
    SINE = "SINE"

class LEDProgram:
    """
    Holds the program steps for one LED and manages transitions.
    Each step can have:
      - type: "ON", "OFF", "RAMP", "SINE"
      - int / int0 / int1
      - freq (for SINE)
      - duration_ms
    """
    def __init__(self, steps, led_index):
        self.steps = steps
        self.led_index = led_index
        
        self.current_step_index = 0
        self.elapsed_in_step = 0  # ms
        self.current_intensity_uw = 0  # µW/cm²

    def update(self, dt_ms):
        """
        Advance program by dt_ms. Returns current intensity in µW/cm².
        """
        if not self.steps:
            # If no steps, always off
            self.current_intensity_uw = 0
            return 0
        
        step = self.steps[self.current_step_index]
        step_type = step.get("type", StepType.OFF)
        duration_ms = step.get("duration_ms", 0)
        
        # Update time
        self.elapsed_in_step += dt_ms
        
        # Check if we need to move to the next step
        if self.elapsed_in_step >= duration_ms:
            # Move to next step
            self.current_step_index = (self.current_step_index + 1) % len(self.steps)
            self.elapsed_in_step = 0
            step = self.steps[self.current_step_index]
            step_type = step.get("type", StepType.OFF)
            duration_ms = step.get("duration_ms", 0)
        
        # Compute intensity based on the current step
        if step_type == StepType.ON:
            # Use the "int" field directly (µW/cm²)
            self.current_intensity_uw = step.get("int", 0)
        
        elif step_type == StepType.OFF:
            self.current_intensity_uw = 0
        
        elif step_type == StepType.RAMP:
            int0 = step.get("int0", 0)
            int1 = step.get("int1", 0)
            frac = 0.0
            if duration_ms > 0:
                frac = self.elapsed_in_step / duration_ms
            # Linear interpolation
            self.current_intensity_uw = int0 + (int1 - int0) * frac
        
        elif step_type == StepType.SINE:
            int0 = step.get("int0", 0)
            int1 = step.get("int1", 0)
            freq = step.get("freq", 1.0)  # in Hz
            midpoint = (int0 + int1) / 2
            amplitude = (int1 - int0) / 2
            t_sec = self.elapsed_in_step / 1000.0
            val = midpoint + amplitude * math.sin(2 * math.pi * freq * t_sec)
            self.current_intensity_uw = val
        
        return self.current_intensity_uw


# -----------------------
# 4) Load program.json
# -----------------------
program_data = {}
try:
    with open("/program.json", "r") as f:
        program_data = json.load(f)
except OSError:
    print("No program.json found or unable to open. Using empty programs.")
    program_data = {}

# Create a LEDProgram for each channel
led_programs = []
for i in range(NUM_CHANNELS):
    steps = program_data.get(f"LED{i}", [])
    led_programs.append(LEDProgram(steps, i))

# -------------
# 5) Main Loop
# -------------
TICK_MS = 10  # We’ll update every 10 ms
last_time_ms = time.monotonic() * 1000

print("Starting the main loop...")

while True:
    now_ms = time.monotonic() * 1000
    elapsed = now_ms - last_time_ms
    
    # Update only if at least TICK_MS has passed
    if elapsed >= TICK_MS:
        last_time_ms = now_ms
        
        # 1) Update all LED programs
        for i in range(NUM_CHANNELS):
            uw_val = led_programs[i].update(TICK_MS)  # µW/cm²
            pwm_12bit = uw_cm2_to_pwm(uw_val, i)
            
            # Directly assign 12-bit value to the channel
            tlc[i] = pwm_12bit
        
        # The library handles writing data to the TLC5947
    
    # Slight pause to avoid maxing the CPU
    time.sleep(0.001)