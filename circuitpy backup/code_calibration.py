import time
import json
import board
import busio
import digitalio
import adafruit_tlc5947

# -----------------------
# Constants
# -----------------------
NUM_CHANNELS = 24  # Number of TLC5947 channels (24 LEDs)
PWM_CALIBRATION_VALUE = 4095  # PWM value for calibration (maximum)
STABILIZATION_TIME = 1  # Time to leave LED on for stabilization (in seconds)

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
# Calibration Function
# -----------------------
def calibrate_leds():
    # Initialize photodiode readings and calibration factors
    photodiode_readings = {}
    calibration_factors = {}

    # Step 1: Calibrate each LED
    for i in range(NUM_CHANNELS):
        print(f"Calibrating LED {i}...")
        
        # Turn on the LED at the calibration PWM value
        led[i] = PWM_CALIBRATION_VALUE
        
        # Wait for stabilization
        time.sleep(STABILIZATION_TIME)
        
        # Prompt user for photodiode reading
        photodiode_reading = float(input(f"Enter photodiode reading (uW/cm2) for LED {i}: "))
        photodiode_readings[i] = photodiode_reading
        
        # Turn off the LED
        led[i] = 0

    # Step 2: Identify the dimmest LED
    dimmest_led = min(photodiode_readings, key=photodiode_readings.get)
    dimmest_reading = photodiode_readings[dimmest_led]
    print(f"Dimmest LED is {dimmest_led} with a reading of {dimmest_reading} µW/cm².")

    # Step 3: Calculate calibration factors
    for i in range(NUM_CHANNELS):
        calibration_factors[i] = dimmest_reading / photodiode_readings[i]
        print(f"Calibration factor for LED {i}: {calibration_factors[i]:.4f}")

# -----------------------
# Main Script
# -----------------------
if __name__ == "__main__":
    print("Starting LED calibration...")
    calibrate_leds()