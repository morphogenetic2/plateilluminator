import board
import busio
import digitalio
import time

import adafruit_tlc5947

# Define pins connected to the TLC5947
SCK = board.SCK
MOSI = board.MOSI
LATCH = digitalio.DigitalInOut(board.D5)
spi = busio.SPI(clock=SCK, MOSI=MOSI)
led = adafruit_tlc5947.TLC5947(spi, LATCH)

#define rows and columns
row=[[0,1,2,3,4,5],[6,7,8,9,10,11],[12,13,14,15,16,17],[18,19,20,21,22,23]]
column=[[0,6,12,18],[1,7,13,19],[2,8,14,20],[3,9,15,21],[4,10,16,22],[5,11,17,23]]

#set global intensity
intensity=1

#strobe function, blinks from column
def strobe(intensity,start_column,end_column,time_on,time_off):
    
    for i in range(start_column,end_column):
        for j in row[i]:
            led[j]=intensity
    time.sleep(time_on)
    for i in range(start_column,end_column):
        for j in row[i]:
            led[j]=0  
    time.sleep(time_off) 

#allplate function: puts all the LEDs at the same intensity, just ON cycle
def allplate(intensity):
    for i in range(0,24):
        led[i]=intensity    


while True:
    strobe(1000,0,2,0.5,0.5)
    