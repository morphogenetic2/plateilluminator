import time
import math
import json

import board
import busio
import digitalio
import adafruit_tlc5947

# -----------------------
# Constants
# -----------------------
NUM_CHANNELS = 24  # Number of TLC5947 channels (24 LEDs)
TICK_MS = 50  # Default update period. This value is overridden dynamically based on the program.json content: 50ms for animations (RAMP/SINE), or optimized for static steps (min 50ms).
SLEEP = 0.001 # time sleep in seconds to avoid CPU overload.

# -----------------------
# Hardware and TLC5947 Setup
# -----------------------
SCK = board.SCK
MOSI = board.MOSI
LATCH_PIN = digitalio.DigitalInOut(board.D5)
LATCH_PIN.direction = digitalio.Direction.OUTPUT

# Create SPI bus and TLC5947 object
spi = busio.SPI(clock=SCK, MOSI=MOSI)
led = adafruit_tlc5947.TLC5947(spi, LATCH_PIN)

# -----------------------
# Load Calibration Data
# -----------------------
try:
    with open("/calibration.json", "r") as f:
        calibration = json.load(f)
except OSError:
    print("No calibration.json found. Defaulting to calibration factors of 1.0 for all LEDs.")
    calibration = {str(i): 1.0 for i in range(NUM_CHANNELS)}  # Default to 1.0 for all LEDs

def uw_cm2_to_pwm(led_uwcm2, led_index):
    """
    Convert intensity in µW/cm² to 12-bit PWM using calibration factors.
    """
    calib_factor = calibration.get(str(led_index), 1.0)  # Default to 1.0 if not in calibration
    led_pwm = int(led_uwcm2 * calib_factor * 2.8833333)
    return max(0, min(4095, led_pwm))  # Clamp to 12-bit range

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
try:
    with open("/program.json", "r") as f:
        program_data = json.load(f)
except OSError:
    print("No program.json found. Defaulting to all LEDs OFF.")
    program_data = {}

# Create LED programs using list comprehension
led_programs = [LEDProgram(program_data.get(f"LED{i}", []), i) for i in range(NUM_CHANNELS)]

# -----------------------
# Dynamic Tick Calculation
# -----------------------
# Determine the optimal TICK_MS.
# If any LED has RAMP or SINE, we calculate based on active animation LEDs.
# If all are ON/OFF, we can use the smallest duration as the tick.
# -----------------------
min_duration = float("inf")
animation_led_indices = set()  # Track LEDs with SINE/RAMP steps

for i in range(NUM_CHANNELS):
    steps = program_data.get(f"LED{i}", [])
    for step in steps:
        dur = step.get("duration_ms", 0)
        s_type = step.get("type", "OFF")
        
        if dur > 0:
            min_duration = min(min_duration, dur)
        
        if s_type in ["RAMP", "SINE"]:
            animation_led_indices.add(i)

# Decide TICK_MS
animation_led_count = len(animation_led_indices)

if animation_led_count > 0:
    # Calculate TICK based on number of animation LEDs
    # ~1.75ms per LED for SPI update, minimum 5ms floor
    import math
    calculated_tick = math.ceil(1.75 * animation_led_count)
    TICK_MS = max(5, calculated_tick)
    print(f"Dynamic TICK: Found {animation_led_count} LEDs with RAMP/SINE. Setting TICK_MS = {TICK_MS}")
elif min_duration != float("inf"):
    # Static program: use step duration as tick (min 50ms for stability)
    TICK_MS = max(50, int(min_duration))
    print(f"Dynamic TICK: Static program. Setting TICK_MS = {TICK_MS}")
else:
    TICK_MS = 50  # Default safe fallback
    print("Dynamic TICK: Defaulting to 50")

# Global Experiment Duration (in minutes, 0 or None means infinite)
total_duration_minutes = program_data.get("total_duration_minutes", 0)
print(f"Global experiment duration: {total_duration_minutes} minutes")

# -----------------------
# Main Control Loop
# -----------------------
print("Starting LED control loop...")

last_time = time.monotonic() * 1000
experiment_start_time = time.monotonic()
experiment_finished = False

while True:
    now = time.monotonic() * 1000
    elapsed = now - last_time
    
    if elapsed >= TICK_MS:
        last_time = now
        
        # Update each LED program and set intensity
        for i in range(NUM_CHANNELS):
            # Check global timeout
            if not experiment_finished and total_duration_minutes > 0:
                total_elapsed_sec = time.monotonic() - experiment_start_time
                if total_elapsed_sec >= (total_duration_minutes * 60):
                    print("Global experiment time reached. Turning off all LEDs.")
                    experiment_finished = True
            
            if experiment_finished:
                 uw_intensity = 0
            else:
                 uw_intensity = led_programs[i].update(TICK_MS)  # µW/cm²
            
            led[i] = uw_cm2_to_pwm(uw_intensity, i)  # Set PWM directly (12-bit)

    # Small sleep to avoid high CPU usage
    time.sleep(SLEEP)
