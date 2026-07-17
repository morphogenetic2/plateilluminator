import time
import board
import busio
import digitalio
import adafruit_tlc5947
import json

# -----------------------
# Constants & Setup
# -----------------------
NUM_CHANNELS = 24
FILENAME = "/calibration.json"

# Hardware Setup (Matches code.py)
SCK = board.SCK
MOSI = board.MOSI
LATCH_PIN = digitalio.DigitalInOut(board.D5)
LATCH_PIN.direction = digitalio.Direction.OUTPUT

spi = busio.SPI(clock=SCK, MOSI=MOSI)
led = adafruit_tlc5947.TLC5947(spi, LATCH_PIN, auto_write=False)

# Calibration points.  The TLC5947 has a 12-bit range (0..4095), but the
# low end is where LED-to-LED differences and the driver's dead zone matter
# most.  Keep the dense low-end sampling; the three upper anchors are only
# there to keep the rest of the range usable.
TEST_POINTS_PWM = [
    1, 50, 200, 500,
    1000, 2000, 4095,
]

# Give the detector time to settle, then take several readings.  The median
# is less sensitive to an occasional unstable reading than a single sample.
STABILIZATION_TIME = 1.0
READINGS_PER_POINT = 1

def log(msg):
    print(f"[CALIBRATE] {msg}")


def progress(current, total):
    """Print a compact progress indicator for the terminal."""
    print(f"[CALIBRATE] Progress: {current}/{total} measurement points complete")

def save_calibration(data):
    """Attempt to save to file, print if read-only."""
    json_str = json.dumps(data)
    try:
        with open(FILENAME, "w") as f:
            f.write(json_str)
        log(f"Successfully wrote to {FILENAME}")
    except OSError:
        log("Filesystem is Read-Only. Cannot write file.")
        log("Please copy the following JSON content and save it as 'calibration.json' on the drive manually:")
        print("\n" + "-"*20)
        print(json_str)
        print("-" * 20 + "\n")


def read_measurement(pwm_val):
    """Read several detector values and return their median."""
    readings = []
    for sample in range(READINGS_PER_POINT):
        while True:
            suffix = "" if READINGS_PER_POINT == 1 else f" (reading {sample + 1}/{READINGS_PER_POINT})"
            user_input = input(f"PWM {pwm_val}{suffix}: Enter measured uW/cm2: ").strip()
            try:
                measured_val = float(user_input)
                if measured_val < 0:
                    print("Value must be zero or positive.")
                    continue
                readings.append(measured_val)
                log(f"Accepted measurement: PWM {pwm_val} = {measured_val:g} uW/cm2")
                break
            except ValueError:
                print("Invalid number. Enter a value such as 0, 0.35, or 12.8.")

    readings.sort()
    middle = len(readings) // 2
    if len(readings) % 2:
        return readings[middle]
    return (readings[middle - 1] + readings[middle]) / 2


def make_monotonic_curve(raw_points):
    """Convert PWM-ordered readings into a safe, strictly ordered inverse curve.

    Firmware interpolation expects points ordered by measured uW/cm2.  Real
    measurements can contain small downward fluctuations, so first enforce a
    non-decreasing response and then remove duplicate measured values.  For a
    duplicate, the largest PWM is retained, which preserves the reachable
    brightness range.
    """
    points = [[0, 0]]
    previous_uw = 0.0

    for measured_uw, pwm_val in raw_points:
        measured_uw = max(0.0, float(measured_uw), previous_uw)
        previous_uw = measured_uw

        # A zero reading at a nonzero PWM is below the detector's measurable
        # threshold.  It must not create a duplicate [0, pwm] point.
        if measured_uw <= 0:
            continue

        points.append([measured_uw, pwm_val])

    deduplicated = []
    for measured_uw, pwm_val in points:
        if deduplicated and measured_uw == deduplicated[-1][0]:
            deduplicated[-1][1] = max(deduplicated[-1][1], pwm_val)
        else:
            deduplicated.append([measured_uw, pwm_val])

    return deduplicated

def main():
    total_points = NUM_CHANNELS * len(TEST_POINTS_PWM)
    completed_points = 0

    log("Starting manual low-PWM-focused calibration sequence...")
    log(f"This script will iterate through all {NUM_CHANNELS} LEDs.")
    log(f"PWM levels per LED: {TEST_POINTS_PWM}")
    log(f"Low-end points: PWM 1, 50, 200, 500")
    log(f"Upper anchors: PWM 1000, 2000, 4095")
    log(f"One manual reading per point; total readings: {total_points}")
    log(f"A {STABILIZATION_TIME:g}-second stabilization delay is used before each reading.")
    log("Use a calibrated optical power meter/radiometer and enter its uW/cm2 reading.")
    log("Enter only the number, for example: 0.35")
    log("Press Ctrl+C at any time to stop; all LEDs will be turned off.")
    
    calibration_data = {}
    
    # Ensure all off initially
    for i in range(NUM_CHANNELS):
        led[i] = 0
    led.write()
    time.sleep(1)

    try:
        for i in range(NUM_CHANNELS):
            log(f"--- Calibrating LED {i} ({i + 1}/{NUM_CHANNELS}) ---")
            log(f"The LED will be tested at {len(TEST_POINTS_PWM)} PWM levels.")
            
            raw_points = []
            
            for pwm_val in TEST_POINTS_PWM:
                # Turn ON
                led[i] = pwm_val
                led.write()
                
                # Let the detector settle before asking for readings.
                log(f"LED {i}: setting PWM to {pwm_val}; waiting {STABILIZATION_TIME:g}s for stabilization...")
                time.sleep(STABILIZATION_TIME)
                measured_val = read_measurement(pwm_val)
                raw_points.append([measured_val, pwm_val])
                print(f"[CALIBRATE] Recorded: LED {i}, PWM {pwm_val}, {measured_val:g} uW/cm2")
                completed_points += 1
                progress(completed_points, total_points)
                
            # Turn OFF
            led[i] = 0
            led.write()
            
            points = make_monotonic_curve(raw_points)
            calibration_data[str(i)] = points
            log(f"LED {i} curve saved with {len(points)} usable points: {points}")
            time.sleep(0.5)

        log("Calibration complete for all LEDs!")
        save_calibration(calibration_data)
        log(f"Calibration data contains {len(calibration_data)} LED curves.")
        
    except KeyboardInterrupt:
        log("\nCalibration Aborted by User.")
        # Turn off all
        for i in range(NUM_CHANNELS):
            led[i] = 0
        led.write()

if __name__ == "__main__":
    main()
