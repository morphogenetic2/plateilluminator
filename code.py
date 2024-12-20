import board
import busio
import digitalio
import time
import json
import adafruit_tlc5947

# ---------------------
# Hardware Setup
# ---------------------
SCK = board.SCK
MOSI = board.MOSI
LATCH = digitalio.DigitalInOut(board.D5)
LATCH.direction = digitalio.Direction.OUTPUT

spi = busio.SPI(clock=SCK, MOSI=MOSI)
tlc = adafruit_tlc5947.TLC5947(spi, LATCH, num_drivers=1)

# Turn all LEDs off initially
for i in range(24):
    tlc[i] = 0

# ---------------------
# Load Program Data
# ---------------------
with open("/program.json", "r") as f:
    all_programs = json.load(f)

# ---------------------
# Calibration Data
# ---------------------
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

def intensity_to_dac(uw_cm2, led_index):
    pwm_output = int(uw_cm2 * calib_white[led_index] * 2.8833333)
    if pwm_output > 4095:
        pwm_output = 4095
    if pwm_output < 0:
        pwm_output = 0
    return pwm_output

# ---------------------
# LED Runtime Setup
# ---------------------
led_runtime = []
for i in range(24):
    led_name = f"LED{i+1}"
    if led_name in all_programs:
        steps = all_programs[led_name]
        current_step = steps[0]
        action = current_step["action"]

        led_info = {
            "led_index": i,
            "steps": steps,
            "current_step_index": 0,
            "step_start_time": time.monotonic(),
            "step_duration": current_step["duration_ms"] / 1000.0,
            "action": action,
            "intensity_uwcm2": 0.0,
            "start_intensity_uwcm2": 0.0,
            "end_intensity_uwcm2": 0.0
        }

        # Initialize step parameters depending on action
        if action == "ON":
            led_info["intensity_uwcm2"] = current_step["intensity_uwcm2"]
        elif action == "OFF":
            led_info["intensity_uwcm2"] = 0
        elif action == "RAMP":
            led_info["start_intensity_uwcm2"] = current_step["start_intensity_uwcm2"]
            led_info["end_intensity_uwcm2"] = current_step["end_intensity_uwcm2"]
            # Initial intensity = start_intensity at step start
            led_info["intensity_uwcm2"] = led_info["start_intensity_uwcm2"]
        else:
            # Unrecognized action, default OFF
            led_info["intensity_uwcm2"] = 0
        
        led_runtime.append(led_info)
    else:
        # LED not in the JSON: remain off
        led_runtime.append(None)

# Initialize LED outputs based on the first step
for led_info in led_runtime:
    if led_info is not None:
        dac_val = intensity_to_dac(led_info["intensity_uwcm2"], led_info["led_index"])
        tlc[led_info["led_index"]] = dac_val

# ---------------------
# Main Loop
# ---------------------
while True:
    now = time.monotonic()
    for led_info in led_runtime:
        if led_info is None:
            continue

        steps = led_info["steps"]
        current_index = led_info["current_step_index"]
        step = steps[current_index]
        action = step["action"]
        elapsed = now - led_info["step_start_time"]

        # Check if step is complete
        if elapsed >= led_info["step_duration"]:
            # Move to next step
            led_info["current_step_index"] += 1
            if led_info["current_step_index"] >= len(steps):
                # Loop back to the first step
                led_info["current_step_index"] = 0

            step = steps[led_info["current_step_index"]]
            action = step["action"]
            led_info["action"] = action
            led_info["step_duration"] = step["duration_ms"] / 1000.0
            led_info["step_start_time"] = now

            if action == "ON":
                led_info["intensity_uwcm2"] = step["intensity_uwcm2"]
            elif action == "OFF":
                led_info["intensity_uwcm2"] = 0
            elif action == "RAMP":
                led_info["start_intensity_uwcm2"] = step["start_intensity_uwcm2"]
                led_info["end_intensity_uwcm2"] = step["end_intensity_uwcm2"]
                led_info["intensity_uwcm2"] = led_info["start_intensity_uwcm2"]
            else:
                # Unknown action, default OFF
                led_info["intensity_uwcm2"] = 0

            # Update LED output immediately at step start
            dac_val = intensity_to_dac(led_info["intensity_uwcm2"], led_info["led_index"])
            tlc[led_info["led_index"]] = dac_val

        else:
            # If still within the current step, update for RAMP steps
            if action == "RAMP":
                # Calculate fraction of step completed
                fraction = elapsed / led_info["step_duration"]
                # Linear interpolation
                current_intensity = (
                    led_info["start_intensity_uwcm2"] +
                    fraction * (led_info["end_intensity_uwcm2"] - led_info["start_intensity_uwcm2"])
                )
                led_info["intensity_uwcm2"] = current_intensity

                # Update LED output
                dac_val = intensity_to_dac(current_intensity, led_info["led_index"])
                tlc[led_info["led_index"]] = dac_val

            # For ON/OFF steps, we do not need continuous updates unless required.

    time.sleep(0.01)
