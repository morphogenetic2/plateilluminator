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
TICK_MS = 50  # 50 ms update period. The whole plate takes 42 ms to update, so the tick needs to be larger than 42 ms. 50 ms is the minimum time that will keep accuracy in the programs.
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
        led_constant = calibration.get("led_constant", 2.8833333) # The default value should be removed when all the calibrations are updated.
        calibration_factors = calibration.get("led_factors", {str(i): 1.0 for i in range(NUM_CHANNELS)})
except OSError:
    print("No calibration.json found. Defaulting to calibration factors of 1.0 for all LEDs and default LED constant.")
    led_constant = 2.8833333  # The default value should be removed when all the calibrations are updated.
    calibration_factors = {str(i): 1.0 for i in range(NUM_CHANNELS)} # Default to 1.0 for all LEDs

def uw_cm2_to_pwm(led_uwcm2, led_index):
    """
    Convert intensity in µW/cm² to 12-bit PWM using calibration factors.
    """
    calib_factor = calibration_factors.get(str(led_index), 1.0)
    led_pwm = int(led_uwcm2 * calib_factor / led_constant * 4095)
    return max(0, min(4095, led_pwm))

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
    def __init__(self, steps, led_index, total_run_time_ms=None):
        self.steps = steps
        self.led_index = led_index
        self.current_step_index = 0
        self.elapsed_in_step = 0  # ms
        self.current_intensity = 0  # µW/cm²
        self.total_run_time_ms = total_run_time_ms
        self.start_time = None  # Will store the start time in ms

    def update(self, dt_ms):
        """
        Update the LED's state based on elapsed time.
        """
        if not self.steps:
            self.current_intensity = 0
            return 0

        if self.start_time is None:
            self.start_time = time.monotonic() * 1000

        # Check for program duration
        if self.total_run_time_ms is not None and (time.monotonic() * 1000 - self.start_time) >= self.total_run_time_ms:
            self.current_intensity = 0
            return 0  # Keep LED off after total run time

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
# JSON Validation Function
# -----------------------
def validate_program_data(program_data):
    """
    Validates the structure and data types of the program data.
    """
    for led_name, led_data in program_data.items():
        if not isinstance(led_name, str) or not led_name.startswith("LED"):
            raise ValueError(f"Invalid LED name: {led_name}")

        if not isinstance(led_data, dict):
            raise ValueError(f"Invalid LED data format for {led_name}")
        
        total_run_time_ms = led_data.get("total_run_time_ms")
        
        if total_run_time_ms is not None and (not isinstance(total_run_time_ms, (int, float)) or total_run_time_ms < 0):
            raise ValueError(f"Invalid total_run_time_ms: {total_run_time_ms} in {led_name}")

        steps = led_data.get("steps", [])

        for step in steps:
            if not isinstance(step, dict):
                raise ValueError(f"Invalid step format in {led_name}")

            step_type = step.get("type")
            if step_type not in [StepType.ON, StepType.OFF, StepType.RAMP, StepType.SINE]:
                raise ValueError(f"Invalid step type: {step_type} in {led_name}")

            duration_ms = step.get("duration_ms")
            if not isinstance(duration_ms, (int, float)) or duration_ms < 0:
                raise ValueError(f"Invalid duration_ms: {duration_ms} in {led_name}")

            # Add more validation based on step type:
            if step_type == StepType.ON:
                if "int" not in step or not isinstance(step["int"], (int, float)) or step["int"] < 0:
                    raise ValueError(f"Invalid 'int' in ON step in {led_name}")
            elif step_type == StepType.RAMP:
                if "int0" not in step or not isinstance(step["int0"], (int, float)) or step["int0"] < 0:
                    raise ValueError(f"Invalid 'int0' in RAMP step in {led_name}")
                if "int1" not in step or not isinstance(step["int1"], (int, float)) or step["int1"] < 0:
                    raise ValueError(f"Invalid 'int1' in RAMP step in {led_name}")
            elif step_type == StepType.SINE:
                if "int0" not in step or not isinstance(step["int0"], (int, float)) or step["int0"] < 0:
                    raise ValueError(f"Invalid 'int0' in SINE step in {led_name}")
                if "int1" not in step or not isinstance(step["int1"], (int, float)) or step["int1"] < 0:
                    raise ValueError(f"Invalid 'int1' in SINE step in {led_name}")
                if "freq" not in step or not isinstance(step["freq"], (int, float)) or step["freq"] < 0:
                    raise ValueError(f"Invalid 'freq' in SINE step in {led_name}")

# -----------------------
# Load Program Data
# -----------------------
try:
    with open("/program.json", "r") as f:
        program_data = json.load(f)
        validate_program_data(program_data) # Validate data
except OSError:
    print("No program.json found. Defaulting to all LEDs OFF.")
    program_data = {}
except ValueError as e:
    print(f"Error in program.json: {e}")
    program_data = {}  # Or handle the error in another way

# Create LED programs
led_programs = []
for i in range(NUM_CHANNELS):
    led_data = program_data.get(f"LED{i}")
    if led_data:
        total_run_time_ms = led_data.get("total_run_time_ms")
        steps = led_data.get("steps", [])
        led_programs.append(LEDProgram(steps, i, total_run_time_ms))
    else:
        led_programs.append(LEDProgram([], i)) # OFF by default

# -----------------------
# Main Control Loop
# -----------------------
print("Starting LED control loop...")

last_time = time.monotonic() * 1000

while True:
    now = time.monotonic() * 1000
    elapsed = now - last_time
    
    if elapsed >= TICK_MS:
        last_time = now
        
        # Update each LED program and set intensity
        for i in range(NUM_CHANNELS):
            uw_intensity = led_programs[i].update(TICK_MS)  # µW/cm²
            led[i] = uw_cm2_to_pwm(uw_intensity, i)  # Set PWM directly (12-bit)

    # Small sleep to avoid high CPU usage
    time.sleep(SLEEP)