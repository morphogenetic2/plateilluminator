import time
import math
import json

import board
import busio
import digitalio
import adafruit_tlc5947

# -----------------------
# Hardware and TLC5947 Setup
# -----------------------
SCK = board.SCK
MOSI = board.MOSI
LATCH_PIN = digitalio.DigitalInOut(board.D5)
LATCH_PIN.direction = digitalio.Direction.OUTPUT

# Create SPI bus and TLC5947 object
spi = busio.SPI(clock=SCK, MOSI=MOSI)
tlc = adafruit_tlc5947.TLC5947(spi, LATCH_PIN)

NUM_CHANNELS = 24  # Number of TLC5947 channels (24 LEDs)

# -----------------------
# Calibration Data
# -----------------------
calib_white = {
    0: 0.8534, 1: 0.8391, 2: 0.8992, 3: 0.8465, 4: 0.8491, 5: 0.9214,
    6: 1.0000, 7: 0.9603, 8: 0.9167, 9: 0.9050, 10: 0.9005, 11: 0.8930,
    12: 0.9453, 13: 0.9203, 14: 0.8780, 15: 0.8512, 16: 0.8784, 17: 0.8751,
    18: 0.9058, 19: 0.8673, 20: 0.8210, 21: 0.8628, 22: 0.9637, 23: 0.9264,
}

def uw_cm2_to_pwm(uw_cm2, led_index):
    """
    Convert intensity in µW/cm² to 12-bit PWM using calibration factors.
    """
    calib_factor = calib_white.get(led_index, 1.0)  # Default to 1.0 if not in calibration
    pwm_value = int(uw_cm2 * calib_factor * 2.8833333)
    return max(0, min(4095, pwm_value))  # Clamp to 12-bit range


# -----------------------
# LED Program and Control
# -----------------------
class StepType:
    ON = "ON"
    OFF = "OFF"
    RAMP = "RAMP"
    SINE = "SINE"

class LEDProgram:
    """
    Handles program steps for one LED.
    """
    def __init__(self, steps, led_index):
        self.steps = steps
        self.led_index = led_index
        self.current_step_index = 0
        self.elapsed_in_step = 0  # ms
        self.current_intensity = 0  # µW/cm²

    def update(self, dt_ms):
        """
        Update the LED's state based on elapsed time.
        """
        if not self.steps:
            self.current_intensity = 0
            return 0
        
        step = self.steps[self.current_step_index]
        step_type = step.get("type", StepType.OFF)
        duration_ms = step.get("duration_ms", 0)
        
        # Update elapsed time in the current step
        self.elapsed_in_step += dt_ms
        
        # Move to next step if the current one is complete
        if self.elapsed_in_step >= duration_ms:
            self.current_step_index = (self.current_step_index + 1) % len(self.steps)
            self.elapsed_in_step = 0
            step = self.steps[self.current_step_index]
            step_type = step.get("type", StepType.OFF)

        # Compute intensity for the current step
        if step_type == StepType.ON:
            self.current_intensity = step.get("int", 0)
        elif step_type == StepType.OFF:
            self.current_intensity = 0
        elif step_type == StepType.RAMP:
            int0 = step.get("int0", 0)
            int1 = step.get("int1", 0)
            fraction = min(1.0, self.elapsed_in_step / duration_ms)
            self.current_intensity = int0 + (int1 - int0) * fraction
        elif step_type == StepType.SINE:
            int0 = step.get("int0", 0)
            int1 = step.get("int1", 0)
            freq = step.get("freq", 1.0)
            amplitude = (int1 - int0) / 2
            midpoint = (int0 + int1) / 2
            t = self.elapsed_in_step / 1000.0  # Time in seconds
            self.current_intensity = midpoint + amplitude * math.sin(2 * math.pi * freq * t)
        
        return self.current_intensity


# -----------------------
# Load Program Data
# -----------------------
program_data = {}
try:
    with open("/program.json", "r") as f:
        program_data = json.load(f)
except OSError:
    print("No program.json found. Defaulting to all LEDs OFF.")
    program_data = {}

# Create LED programs
led_programs = []
for i in range(NUM_CHANNELS):
    steps = program_data.get(f"LED{i}", [])
    led_programs.append(LEDProgram(steps, i))

# -----------------------
# Main Control Loop
# -----------------------
TICK_MS = 10  # 10 ms update period
last_time = time.monotonic() * 1000

print("Starting LED control loop...")

while True:
    now = time.monotonic() * 1000
    elapsed = now - last_time
    
    if elapsed >= TICK_MS:
        last_time = now
        
        # Update each LED program and set intensity
        for i in range(NUM_CHANNELS):
            uw_intensity = led_programs[i].update(TICK_MS)  # µW/cm²
            tlc[i] = uw_cm2_to_pwm(uw_intensity, i)  # Set PWM directly (12-bit)

    # Small sleep to avoid high CPU usage
    time.sleep(0.001)
