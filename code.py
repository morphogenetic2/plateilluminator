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
TICK_S = 0.05  # Default update period. This value is overridden dynamically based on the program.json content.
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
led = adafruit_tlc5947.TLC5947(spi, LATCH_PIN, auto_write=False)  # Disable auto-write to prevent flicker


# -----------------------
# Load Calibration Data
# -----------------------
try:
    with open("/calibration.json", "r") as f:
        calibration = json.load(f)
except OSError:
    print("No calibration.json found. Defaulting to calibration factors of 1.0 for all LEDs.")
    calibration = {str(i): 1.0 for i in range(NUM_CHANNELS)}  # Default to 1.0 for all LEDs

# -----------------------
# Calibration Curve (uW/cm^2 -> PWM)
# Points: (0,0), (6.79,10), (18.2,50), (70,100), (355,500), (1390,2000), (2820,4095)
# -----------------------
CALIBRATION_CURVE = [
    (0, 0),
    (6.79, 10),
    (18.2, 50),
    (70, 100),
    (355, 500),
    (1390, 2000),
    (2820, 4095)
]

def interpolate_pwm(target_uw, curve):
    """
    Interpolate PWM value from the provided calibration curve.
    Curve must be a list of (uW, PWM) tuples sorted by uW.
    """
    # Handle out of bounds
    if target_uw <= 0:
        return 0
    if not curve:
        return 0
        
    if target_uw >= curve[-1][0]:
        return curve[-1][1]

    # Find the segment
    for i in range(len(curve) - 1):
        p1 = curve[i]
        p2 = curve[i+1]
        
        if p1[0] <= target_uw <= p2[0]:
            # Linear interpolation: y = y1 + (x - x1) * (y2 - y1) / (x2 - x1)
            fraction = (target_uw - p1[0]) / (p2[0] - p1[0])
            pwm = p1[1] + fraction * (p2[1] - p1[1])
            return int(pwm)
    
    return 4095 # Should not happen given checks above

def uw_cm2_to_pwm(led_uwcm2, led_index):
    """
    Convert intensity in µW/cm² to 12-bit PWM using calibration data.
    Supports both legacy (single factor) and new (curve) formats.
    """
    calib_data = calibration.get(str(led_index), 1.0)
    
    if isinstance(calib_data, list):
        # New Format: Specific Curve for this LED
        # calib_data is [[uW, PWM], [uW, PWM], ...]
        return int(interpolate_pwm(led_uwcm2, calib_data))
    else:
        # Legacy/Default Format: Single Factor + Default Curve
        # calib_data is a float (factor)
        effective_target_uw = led_uwcm2 * float(calib_data)
        return int(interpolate_pwm(effective_target_uw, CALIBRATION_CURVE))

# -----------------------
# LED Program and Control
# -----------------------
class StepType:
    ON = "ON"
    OFF = "OFF"
    RAMP = "RAMP"
    SINE = "SINE"

class LEDblock:
    """
    Represents a block (sequence) of steps with repeat logic.
    """
    def __init__(self, steps, repeat_duration_s=None, repeat_count=None, repeat_continuous=False):
        self.steps = steps
        self.repeat_duration_s = repeat_duration_s
        self.repeat_count = repeat_count
        self.repeat_continuous = repeat_continuous
        
        self.current_step_index = 0
        self.elapsed_in_step = 0  # seconds
        self.block_start_time = 0  # Will be set when block becomes active
        self.repetition_count = 0  # How many times we've completed the step sequence
        
    def reset(self, current_time_s):
        """Reset block to initial state."""
        self.current_step_index = 0
        self.elapsed_in_step = 0
        self.block_start_time = current_time_s
        self.repetition_count = 0
        
    def is_complete(self, current_time_s):
        """Check if this block has finished all its repetitions."""
        if not self.steps:
            return True

        # Infinite loop
        if self.repeat_continuous:
            return False
            
        # Check duration-based completion
        if self.repeat_duration_s is not None and self.repeat_duration_s > 0:
            elapsed_s = current_time_s - self.block_start_time
            if elapsed_s >= self.repeat_duration_s:
                return True
                
        # Check count-based completion
        if self.repeat_count is not None and self.repeat_count > 0:
            if self.repetition_count >= self.repeat_count:
                return True
                
        # If neither repeat setting, block completes after one cycle (unless continuous)
        if self.repeat_duration_s is None and self.repeat_count is None:
            if self.repetition_count >= 1:
                return True
                
        return False
        
    def update_step(self, dt_s, current_time_s):
        """
        Update the current step within this block.
        Returns the current intensity.
        """
        if not self.steps:
            return 0
            
        step = self.steps[self.current_step_index]
        step_type = step.get("type", StepType.OFF)
        duration_s = step.get("duration_s", (step.get("duration_ms", 0) / 1000.0))
        
        # Update elapsed time in the current step
        self.elapsed_in_step += dt_s
        
        # Move to next step if the current one is complete
        if duration_s > 0 and self.elapsed_in_step >= duration_s:
            self.current_step_index += 1
            self.elapsed_in_step = 0
            
            # If we've completed all steps, loop back to start
            if self.current_step_index >= len(self.steps):
                self.current_step_index = 0
                self.repetition_count += 1
                
            step = self.steps[self.current_step_index]
            step_type = step.get("type", StepType.OFF)

        # Compute intensity for the current step
        intensity = 0
        if step_type == StepType.ON:
            intensity = step.get("int", 0)
        elif step_type == StepType.OFF:
            intensity = 0
        elif step_type == StepType.RAMP:
            int0 = step.get("int0", 0)
            int1 = step.get("int1", 0)
            fraction = min(1.0, self.elapsed_in_step / duration_s) if duration_s > 0 else 1.0
            intensity = int0 + (int1 - int0) * fraction
        elif step_type == StepType.SINE:
            int0 = step.get("int0", 0)
            int1 = step.get("int1", 0)
            freq = step.get("freq", 1.0)
            amplitude = (int1 - int0) / 2
            midpoint = (int0 + int1) / 2
            # For SINE wave continuity, use time since block started
            t_block = current_time_s - self.block_start_time
            intensity = midpoint + amplitude * math.sin(2 * math.pi * freq * t_block)
            
        return intensity


class LEDProgram:
    """
    Handles block-based program execution for one LED.
    """
    def __init__(self, blocks, led_index):
        self.blocks = blocks
        self.led_index = led_index
        self.current_block_index = 0
        self.current_intensity = 0  # µW/cm²
        self.program_start_time = 0
        
        # Initialize first block
        if self.blocks:
            self.blocks[0].reset(time.monotonic())

    def update(self, dt_s, current_time_s):
        """
        Update the LED's state based on elapsed time.
        Now handles block transitions.
        """
        if not self.blocks:
            self.current_intensity = 0
            return 0
            
        # Get current block
        if self.current_block_index >= len(self.blocks):
            # All blocks complete - turn off
            self.current_intensity = 0
            return 0
            
        current_block = self.blocks[self.current_block_index]
        
        # Check if current block is complete
        if current_block.is_complete(current_time_s):
            # Move to next block
            self.current_block_index += 1
            
            if self.current_block_index >= len(self.blocks):
                # All blocks complete
                self.current_intensity = 0
                return 0
            else:
                # Initialize next block
                self.blocks[self.current_block_index].reset(current_time_s)
                current_block = self.blocks[self.current_block_index]
        
        # Update current block and get intensity
        self.current_intensity = current_block.update_step(dt_s, current_time_s)
        return self.current_intensity

# -----------------------
# Load Program Data and Convert to blocks
# -----------------------
try:
    with open("/program.json", "r") as f:
        program_data = json.load(f)
except OSError:
    print("No program.json found. Defaulting to all LEDs OFF.")
    program_data = {}

def convert_to_blocks(led_data):
    """
    Convert LED program data to block format.
    Supports both legacy (array of steps) and new (blocks) formats.
    """
    if not led_data:
        return []
        
    # Check if already in block format
    if isinstance(led_data, dict) and "blocks" in led_data:
        # New format: convert block data to LEDblock objects
        blocks = []
        for block_data in led_data["blocks"]:
            steps = block_data.get("steps", [])
            repeat_duration = block_data.get("repeat_duration_s", (block_data.get("repeat_duration_minutes", 0) * 60.0) if block_data.get("repeat_duration_minutes") else None)
            repeat_count = block_data.get("repeat_count")
            repeat_continuous = block_data.get("repeat_continuous", False)
            blocks.append(LEDblock(steps, repeat_duration, repeat_count, repeat_continuous))
        return blocks
    elif isinstance(led_data, list):
        # Legacy format: convert entire step array to single block
        # This block repeats until global timeout (handled by main loop)
        print("Legacy format detected - converting to single repeating block")
        return [LEDblock(led_data, repeat_duration_s=None, repeat_count=None)]
    else:
        return []

# Create LED programs using block conversion
led_programs = []
for i in range(NUM_CHANNELS):
    led_key = f"LED{i}"
    blocks = convert_to_blocks(program_data.get(led_key, []))
    led_programs.append(LEDProgram(blocks, i))

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
    blocks = led_programs[i].blocks
    for block in blocks:
        for step in block.steps:
            dur = step.get("duration_ms", 0)
            s_type = step.get("type", "OFF")
            
            if dur > 0:
                min_duration = min(min_duration, dur)
            
            if s_type in ["RAMP", "SINE"]:
                animation_led_indices.add(i)

# Decide TICK_S
animation_led_count = len(animation_led_indices)

if animation_led_count > 0:
    # Calculate TICK based on number of animation LEDs
    # ~1.75ms per LED for SPI update, minimum 5ms floor
    import math
    calculated_tick_ms = math.ceil(1.75 * animation_led_count)
    TICK_S = max(0.005, calculated_tick_ms / 1000.0)
    print(f"Dynamic TICK: Found {animation_led_count} LEDs with RAMP/SINE. Setting TICK_S = {TICK_S}")
elif min_duration != float("inf"):
    # Static program: use step duration as tick (min 50ms, max 1000ms)
    tick_candidate_ms = max(50, int(min_duration))
    TICK_S = min(tick_candidate_ms, 1000) / 1000.0
    print(f"Dynamic TICK: Static program. Setting TICK_S = {TICK_S}")
else:
    TICK_S = 0.05  # Default safe fallback
    print("Dynamic TICK: Defaulting to 0.05")

# Global Experiment Duration (in seconds, 0 or None means infinite)
total_duration_s = program_data.get("total_duration_s", (program_data.get("total_duration_minutes", 0) * 60) if program_data.get("total_duration_minutes") else 0)
print(f"Global experiment duration: {total_duration_s} seconds")

# -----------------------
# Main Control Loop
# -----------------------
print("Starting LED control loop...")

last_time = time.monotonic()
experiment_start_time = time.monotonic()
experiment_finished = False

while True:
    now = time.monotonic()
    elapsed = now - last_time
    
    if elapsed >= TICK_S:
        last_time = now
        
        # Update each LED program and set intensity
        for i in range(NUM_CHANNELS):
            # Check global timeout
            if not experiment_finished and total_duration_s > 0:
                total_elapsed_sec = time.monotonic() - experiment_start_time
                if total_elapsed_sec >= total_duration_s:
                    print("Global experiment time reached. Turning off all LEDs.")
                    experiment_finished = True
            
            if experiment_finished:
                 uw_intensity = 0
            else:
                 # Pass actual elapsed time and current time
                 uw_intensity = led_programs[i].update(elapsed, now)  # µW/cm²
            
            led[i] = uw_cm2_to_pwm(uw_intensity, i)  # Set PWM directly (12-bit)
        
        # Write all PWM values to hardware in one batch (prevents flicker)
        led.write()

    # Small sleep to avoid high CPU usage
    time.sleep(SLEEP)


