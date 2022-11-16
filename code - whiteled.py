import time

import adafruit_tlc5947
import board
import busio
import digitalio
import json

# Define pins connected to the TLC5947
SCK = board.SCK
MOSI = board.MOSI
LATCH = digitalio.DigitalInOut(board.D5)
spi = busio.SPI(clock=SCK, MOSI=MOSI)
led = adafruit_tlc5947.TLC5947(spi, LATCH)

#row and column definition
row = [
    [0, 1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10, 11],
    [12, 13, 14, 15, 16, 17],
    [18, 19, 20, 21, 22, 23],
]
column = [
    [0, 6, 12, 18],
    [1, 7, 13, 19],
    [2, 8, 14, 20],
    [3, 9, 15, 21],
    [4, 10, 16, 22],
    [5, 11, 17, 23],
]

# calibration dictionary, the normalization needs to be divided by 10000 and multiplied by the intended intensity value
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


#slope for blue leds is 0.3343
#
def allplate(int1):
    """
    switches on the full plate at the corresponding intensity
    calib[i] refers to the normalization values in a scale 1 to 10,000,
    0.3343 is the slope in the int1/actual intensity curve
    and 0.74 is the conversion factor from the sensor size, 0.74cm2 to 1cm2,
    input values for int1 are in uW/cm2, minimum value is 0.7 and maximum
    value is around 1400 (for 4096 bit intensity in the LED, normalized)
    """
    for i in range(0, 24):
        led[i] = int(int1 * (calib_white[i]) * (1 / 0.5763))


"""
Plate dictionary: the pairs are position (0 to 23)
followed by the intensity in uW/cm2, the
conversion is done in the while loop below

The plate values are read from a JSON file with the code below
"""

with open("out_plate.json") as file:
    plate = json.load(file)

t = 0  #initialize the "t" counter
total_min = plate[
    "time_minutes"]  #reads the "time_minutes" value from the JSON, total time on in minutes
keepalive = plate[
    "keepalive"]  #reads the "keepalive" value from the JSON, 60 by default
pulse = plate["pulse"]  #reads the "pulse_time" value
pause = plate["pause"]  #reads the "pause" value from JSON


def activate(plate):
    """
        Since this board tends to go crazy after a while, we implemented this hack
        to keep the plate alive. The total_min is the number of minutes (or more exactly,
        the time in seconds from multiplying total_min * keepalive) if keepalive is 60,
        but can be modified at will.

        Then, the JSON dictionary has a key (string) with the number of the well in the layout,
        and an integer value that gives the intensity in uW/cm2 that will be later converted in the
        function. Since the led[] and calib[] need to be integers, they are iterated from the range(0,24) function. But the plate[], that reads from the JSON dictionary, needs to be called as a string, so the i iterator is converted to str(i) for this, instead of using a "layout" with strings.

        led[i] activates the corresponding led
        plate[str(i)] reads the position:intensity from the imported JSON file
        calib[i] reads the normalization values from the calibration dictionary
        then it does the normalization (dividing by 10000) and then multiplies by
        0.3343 and 0.74, the correction factors for the value/intensity slope and
        for the sensor calibration area.
        For example, to have 100 uW/cm2, we send the value 100 to the
        function, does the calibratioin, then it divides by 0.3343 and multiplies by 0.74
        to get the adjusted 14-bit value to the LED driver. As an example,
        intensity 1024 gives an output of 360 uW/cm2
    """

    for i in range(0, 24):
        led[i] = int(plate[str(i)] * (calib_white[i]) * (1 / 0.3343) * 0.74)


'''
while t < total_min:

    activate(plate)  #activate with the JSON values
    time.sleep(pulse)  #keep alive for "pulse" seconds
    allplate(0)  #deactivate
    time.sleep(pause)  #keep off for "pause" seconds

    t = t + (
        (pause + pulse) / 60)  #sum the cycle in nth increments of a minute

while True:
    """
    This part is to keep the plate off every 60 seconds, if not will start again on its own
    """
    allplate(0)
    time.sleep(60)
'''

activate(plate)