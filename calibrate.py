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

# Calibration Points (PWM values to test)
# Low (to fix offset/threshold), Mid (linear region), High (max)
# PWM 100 is approx 2% duty cycle, ensuring we are above the "dead zone" but low enough.
TEST_POINTS_PWM = [100, 2000, 4095] 

def log(msg):
    print(f"[CALIBRATE] {msg}")

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

def main():
    log("Starting 3-Point Calibration Sequence...")
    log(f"This script will iterate through all {NUM_CHANNELS} LEDs.")
    log(f"For each LED, we will test {len(TEST_POINTS_PWM)} brightness levels: {TEST_POINTS_PWM}.")
    log("Please measure the output in uW/cm2 and enter the value.")
    
    calibration_data = {}
    
    # Ensure all off initially
    for i in range(NUM_CHANNELS):
        led[i] = 0
    led.write()
    time.sleep(1)

    try:
        for i in range(NUM_CHANNELS):
            log(f"--- Calibrating LED {i} ---")
            
            points = [[0, 0]] # Always start with 0,0
            
            for pwm_val in TEST_POINTS_PWM:
                # Turn ON
                led[i] = pwm_val
                led.write()
                
                # Wait for measurement
                while True:
                    user_input = input(f"PWM {pwm_val}: Enter measured uW/cm2: ")
                    try:
                        measured_val = float(user_input)
                        if measured_val < 0:
                            print("Value must be positive.")
                            continue
                        break
                    except ValueError:
                        print("Invalid number.")
                
                # Store Point: [uW, PWM] (We map uW input -> PWM output)
                points.append([measured_val, pwm_val])
                points.sort(key=lambda x: x[0]) # Keep sorted by uW
                
            # Turn OFF
            led[i] = 0
            led.write()
            
            calibration_data[str(i)] = points
            print(f"Recorded curve for LED {i}: {points}")
            time.sleep(0.5)

        log("Calibration Complete!")
        save_calibration(calibration_data)
        
    except KeyboardInterrupt:
        log("\nCalibration Aborted by User.")
        # Turn off all
        for i in range(NUM_CHANNELS):
            led[i] = 0
        led.write()

if __name__ == "__main__":
    main()
