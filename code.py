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

class LEDChunk:
    """
    Represents a chunk (sequence) of steps with repeat logic.
    """
    def __init__(self, steps, repeat_duration_minutes=None, repeat_count=None):
        self.steps = steps
        self.repeat_duration_minutes = repeat_duration_minutes
        self.repeat_count = repeat_count
        
        self.current_step_index = 0
        self.elapsed_in_step = 0  # ms
        self.chunk_start_time = 0  # Will be set when chunk becomes active
        self.repetition_count = 0  # How many times we've completed the step sequence
        
    def reset(self, current_time_ms):
        """Reset chunk to initial state."""
        self.current_step_index = 0
        self.elapsed_in_step = 0
        self.chunk_start_time = current_time_ms
        self.repetition_count = 0
        
    def is_complete(self, current_time_ms):
        """Check if this chunk has finished all its repetitions."""
        if not self.steps:
            return True
            
        # Check duration-based completion
        if self.repeat_duration_minutes is not None and self.repeat_duration_minutes > 0:
            elapsed_minutes = (current_time_ms - self.chunk_start_time) / 60000.0
            if elapsed_minutes >= self.repeat_duration_minutes:
                return True
                
        # Check count-based completion
        if self.repeat_count is not None and self.repeat_count > 0:
            if self.repetition_count >= self.repeat_count:
                return True
                
        # If neither repeat setting, chunk completes after one cycle
        if self.repeat_duration_minutes is None and self.repeat_count is None:
            if self.repetition_count >= 1:
                return True
                
        return False
        
    def update_step(self, dt_ms):
        """
        Update the current step within this chunk.
        Returns the current intensity.
        """
        if not self.steps:
            return 0
            
        step = self.steps[self.current_step_index]
        step_type = step.get("type", StepType.OFF)
        duration_ms = step.get("duration_ms", 0)
        
        # Update elapsed time in the current step
        self.elapsed_in_step += dt_ms
        
        # Move to next step if the current one is complete
        if self.elapsed_in_step >= duration_ms:
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
            fraction = min(1.0, self.elapsed_in_step / duration_ms)
            intensity = int0 + (int1 - int0) * fraction
        elif step_type == StepType.SINE:
            int0 = step.get("int0", 0)
            int1 = step.get("int1", 0)
            freq = step.get("freq", 1.0)
            amplitude = (int1 - int0) / 2
            midpoint = (int0 + int1) / 2
            t = self.elapsed_in_step / 1000.0  # Time in seconds
            intensity = midpoint + amplitude * math.sin(2 * math.pi * freq * t)
            
        return intensity


class LEDProgram:
    """
    Handles chunk-based program execution for one LED.
    """
    def __init__(self, chunks, led_index):
        self.chunks = chunks
        self.led_index = led_index
        self.current_chunk_index = 0
        self.current_intensity = 0  # µW/cm²
        self.program_start_time = 0
        
        # Initialize first chunk
        if self.chunks:
            self.chunks[0].reset(0)

    def update(self, dt_ms, current_time_ms):
        """
        Update the LED's state based on elapsed time.
        Now handles chunk transitions.
        """
        if not self.chunks:
            self.current_intensity = 0
            return 0
            
        # Get current chunk
        if self.current_chunk_index >= len(self.chunks):
            # All chunks complete - turn off
            self.current_intensity = 0
            return 0
            
        current_chunk = self.chunks[self.current_chunk_index]
        
        # Check if current chunk is complete
        if current_chunk.is_complete(current_time_ms):
            # Move to next chunk
            self.current_chunk_index += 1
            
            if self.current_chunk_index >= len(self.chunks):
                # All chunks complete
                self.current_intensity = 0
                return 0
            else:
                # Initialize next chunk
                self.chunks[self.current_chunk_index].reset(current_time_ms)
                current_chunk = self.chunks[self.current_chunk_index]
        
        # Update current chunk and get intensity
        self.current_intensity = current_chunk.update_step(dt_ms)
        return self.current_intensity

# -----------------------
# Load Program Data and Convert to Chunks
# -----------------------
try:
    with open("/program.json", "r") as f:
        program_data = json.load(f)
except OSError:
    print("No program.json found. Defaulting to all LEDs OFF.")
    program_data = {}

def convert_to_chunks(led_data):
    """
    Convert LED program data to chunk format.
    Supports both legacy (array of steps) and new (chunks) formats.
    """
    if not led_data:
        return []
        
    # Check if already in chunk format
    if isinstance(led_data, dict) and "chunks" in led_data:
        # New format: convert chunk data to LEDChunk objects
        chunks = []
        for chunk_data in led_data["chunks"]:
            steps = chunk_data.get("steps", [])
            repeat_duration = chunk_data.get("repeat_duration_minutes")
            repeat_count = chunk_data.get("repeat_count")
            chunks.append(LEDChunk(steps, repeat_duration, repeat_count))
        return chunks
    elif isinstance(led_data, list):
        # Legacy format: convert entire step array to single chunk
        # This chunk repeats until global timeout (handled by main loop)
        print("Legacy format detected - converting to single repeating chunk")
        return [LEDChunk(led_data, repeat_duration_minutes=None, repeat_count=None)]
    else:
        return []

# Create LED programs using chunk conversion
led_programs = []
for i in range(NUM_CHANNELS):
    led_key = f"LED{i}"
    chunks = convert_to_chunks(program_data.get(led_key, []))
    led_programs.append(LEDProgram(chunks, i))

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
    chunks = led_programs[i].chunks
    for chunk in chunks:
        for step in chunk.steps:
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
    # Static program: use step duration as tick (min 50ms, max 1000ms)
    tick_candidate = max(50, int(min_duration))
    TICK_MS = min(tick_candidate, 1000)  # Cap at 1 second for responsiveness
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
                 # BUGFIX: Pass actual elapsed time, not target TICK_MS
                 # This ensures SINE/RAMP calculations use real-world timing
                 # Also pass current time for chunk completion tracking
                 uw_intensity = led_programs[i].update(elapsed, now)  # µW/cm²
            
            led[i] = uw_cm2_to_pwm(uw_intensity, i)  # Set PWM directly (12-bit)
        
        # Write all PWM values to hardware in one batch (prevents flicker)
        led.write()

    # Small sleep to avoid high CPU usage
    time.sleep(SLEEP)

