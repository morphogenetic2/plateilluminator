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
PWM_STEPS = [0, 2048, 4095]  # PWM values to test for calibration

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

# -----------------------
# Calibration Function
# -----------------------
def calibrate_leds():
    """
    Calibrate each LED by stepping through PWM values and asking the user for power meter readings.
    """
    calibration_data = {}

    for led_index in range(NUM_CHANNELS):
        print(f"\nCalibrating LED {led_index}...")
        calibration_data[led_index] = {}

        for pwm_value in PWM_STEPS:
            # Set the PWM value for the current LED
            tlc[led_index] = pwm_value
            time.sleep(1)  # Wait for the LED to stabilize

            # Ask the user for the power meter reading
            user_input = input(f"Enter the power meter reading (µW/cm²) for PWM {pwm_value}: ")
            try:
                measured_intensity = float(user_input)
            except ValueError:
                print("Invalid input. Please enter a numeric value.")
                return

            # Calculate the calibration factor for this PWM value
            if pwm_value == 0:
                calibration_data[led_index][pwm_value] = 0.0  # No light, so calibration factor is 0
            else:
                calibration_factor = measured_intensity / pwm_value
                calibration_data[led_index][pwm_value] = calibration_factor

            print(f"Calibration factor for PWM {pwm_value}: {calibration_factor}")

        # Calculate the average calibration factor for this LED
        calibration_factors = [factor for factor in calibration_data[led_index].values() if factor != 0]
        average_factor = sum(calibration_factors) / len(calibration_factors) if calibration_factors else 1.0
        calibration_data[led_index] = average_factor

        print(f"Average calibration factor for LED {led_index}: {average_factor}")

    # Save the calibration data to a JSON file
    with open("calibration.json", "w") as f:
        json.dump(calibration_data, f, indent=4)

    print("\nCalibration complete. Calibration data saved to 'calibration.json'.")

# -----------------------
# Main Script
# -----------------------
if __name__ == "__main__":
    print("Starting LED calibration process...")
    calibrate_leds()