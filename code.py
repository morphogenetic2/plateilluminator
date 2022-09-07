import board
import busio
import digitalio
import adafruit_tlc5947
import time

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
    calib[i] refers to the normalization values in a scale 1 to 10 000,
    0.3343 is the slope in the int1/actual intensity curve
    and 0.74 is the conversion factor from the sensor size, 0.74cm2 to 1cm2,
    input values for int1 are in uW/cm2, minimum value is 0.7 and maximum
    value is around 1400"""
    for i in range(0, 24):
        led[i] = int(int1 * (calib[i] / 10000) * (1 / 0.3343) * 0.74)


"""
Plate dictionary: the pairs are position (0 to 24)
followed by the intensity in uW/cm2, the
conversion is done in the indiv() function
"""
plate = {
    0: 320,
    1: 320,
    2: 320,
    3: 180,
    4: 180,
    5: 180,
    6: 2,
    7: 2,
    8: 2,
    9: 8,
    10: 8,
    11: 8,
    12: 20,
    13: 20,
    14: 20,
    15: 60,
    16: 60,
    17: 60,
    18: 120,
    19: 120,
    20: 120,
    21: 240,
    22: 240,
    23: 240,
}


def indiv():
    """explanation: led[i] activates the corresponding led
    plate[i] reads the position:intensity from the plate dictionary (above)
    calib[i] reads the normalization values from the calibration dictionary
    then it does the normalization (dividing by 10000) and then multiplies by
    0.3343 and 0.74, the correction factors
    for example, to have 100 uW/cm2, we send the value 100 to the
    function, then it divides by 0.3343 and multiplies by 0.74 to get
    the adjusted 14-bit value to the LED driver. As an example,
    intensity 1024 gives an output of
    """
    for i in range(0, 24):
        led[i] = int(plate[i] * (calib[i] / 10000) * (1 / 0.3343) * 0.74)

while True:
    """
    To keep the plate "alive" we use the time.sleep(5), so it resets the illumination
    every 5 seconds and doesn't get stuck after a while
    """
    indiv()
    time.sleep(5)

    
