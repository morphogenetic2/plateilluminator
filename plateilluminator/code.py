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
calib = {
    0: 8926,
    1: 7254,
    2: 7871,
    3: 9147,
    4: 9040,
    5: 10000,
    6: 7834,
    7: 7480,
    8: 9296,
    9: 7871,
    10: 8580,
    11: 8743,
    12: 8802,
    13: 7614,
    14: 7710,
    15: 8320,
    16: 8473,
    17: 8264,
    18: 7996,
    19: 7948,
    20: 7683,
    21: 8694,
    22: 7500,
    23: 9709,
}


def allplate(int1):
    """switches on the full plate at the corresponding intensity
    calib[i] refers to the normalization values in a scale 1 to 10,000,
    0.3343 is the slope in the int1/actual intensity curve
    and 0.74 is the conversion factor from the sensor size, 0.74cm2 to 1cm2,
    input values for int1 are in uW/cm2, minimum value is 0.7 and maximum
    value is around 1400 (for 4096 bit intensity in the LED, normalized)"""
    for i in range(0, 24):
        led[i] = int(int1 * (calib[i] / 10000) * (1 / 0.3343) * 0.74)


"""
Plate dictionary: the pairs are position (0 to 23)
followed by the intensity in uW/cm2, the
conversion is done in the while loop below

The plate values are read from a JSON file with the code below
"""

with open("out_plate.json") as file:
    plate = json.load(file)

layout = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "20",
    "21",
    "22",
    "23",
]
t = 0
total_min = 30

while t <= total_min - 1:
    """
    To keep the plate "alive" for a certain number of minutes, if not the plate will
    go crazy.
    total_min is the number of minutes to run the plate
    t is the "timer"

    Since the data is saved as a json with the index i as a string, we need to convert this
    to integer, so d=int(i) and we pass d to the function.

    explanation: led[d] activates the corresponding led
    plate[d] reads the position:intensity from the imported JSON file
    calib[d] reads the normalization values from the calibration dictionary
    then it does the normalization (dividing by 10000) and then multiplies by
    0.3343 and 0.74, the correction factors for the value/intensity slope and
    for the sensor calibration area.
    For example, to have 100 uW/cm2, we send the value 100 to the
    function, does the calibratioin, then it divides by 0.3343 and multiplies by 0.74
    to get the adjusted 14-bit value to the LED driver. As an example,
    intensity 1024 gives an output of 360 uW/cm2
    """
    for i in layout:
        d = int(i)
        led[d] = int(plate[i] * (calib[d] / 10000) * (1 / 0.3343) * 0.74)
    time.sleep(60)
    t = t + 1

while True:
    """
    This part is to keep the plate off every 10 seconds, if not will start again on its own
    """
    allplate(0)
    time.sleep(10)
