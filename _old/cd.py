import RPi.GPIO as GPIO
import os
import subprocess
import pygame
import time
import threading
from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import json
import logging

## set up pins
GPIO.setmode(GPIO.BCM)

## set up buttons
pauseInput = 13
nextInput = 6
prevInput = 19
stopInput = 26
playOutput = 21

GPIO.setup(pauseInput, GPIO.IN, pull_up_down=GPIO.PUD_UP)
GPIO.setup(nextInput, GPIO.IN, pull_up_down=GPIO.PUD_UP)
GPIO.setup(prevInput, GPIO.IN, pull_up_down=GPIO.PUD_UP)
GPIO.setup(stopInput, GPIO.IN, pull_up_down=GPIO.PUD_UP)
GPIO.setup(playOutput, GPIO.OUT)

## init pygame cd checker
pygame.cdrom.init()
cd = pygame.cdrom.CD(0)
cd.init()
isPlaying = False
isPaused = False
audioPlayer = None
curSong = 0
tracksInfo = []
numTracks = 0
playStart = 0
playTime = 0
pauseStart = 0

## turns of the playback and ejects the CD 
def endPlaying():
    global isPlaying
    global isPaused
    global curSong
    try:
        audioPlayer.kill()
    except:
        print("Nothing is playing.")
    os.system('eject cdrom')
    isPlaying = False
    isPaused = False
    curSong = 0
    GPIO.output(playOutput, GPIO.LOW)
    sendStatus()

## changes song to +parameter (if the parameter is 1, it will change to next song, if -1, it will change to previous song
def changeSong(song):
    global curSong
    global playStart
    if isPlaying and not isPaused:
        curSong = (curSong + song) % (numTracks)
        seek = cd.get_track_start(curSong)
        print(seek)
        string = ''.join(['seek ',str(seek),' 2 \n']);
        audioPlayer.stdin.write(string)
        print(curSong)
        playStart = (time.time()-seek)
        sendStatus()
    time.sleep(0.2)

## seeks to +parameter (if the parameter is 60000, it will seek to plus one minute, etc.)
def seek(timeDiff):
    global playStart
    if isPlaying and not isPaused:
        seek = playTime + timeDiff
        print(seek)
        string = ''.join(['seek ',str(seek),' 2 \n']);
        audioPlayer.stdin.write(string)
        playStart = (time.time()-seek)
        sendStatus()

## pauses the playback
def pauseSong():
    global pauseStart
    global isPaused
    global playStart
    if isPlaying:
        if not isPaused:
            isPaused = True
            pauseStart = time.time()
        else:
            isPaused = False
            pauseLength = (time.time()-pauseStart)
            playStart += pauseLength
        audioPlayer.stdin.write('pause\n')
        sendStatus()
    time.sleep(0.2)
    
checkSongThread = None

## checks the number of current song every 0.2 seconds
def checkSong():
    global curSong
    global playTime
    global checkSongThread
    checkSongThread = threading.Timer(0.2, checkSong)
    checkSongThread.setDaemon(True)
    if isPlaying == True:
        checkSongThread.start()
        playTime = time.time()-playStart
        for (i, trackInfo) in enumerate(tracksInfo):
            if playTime > trackInfo[1] and playTime < trackInfo[2]:
                curSong = i
    sendStatus()

## sends the status of the playback to the websocket
def sendStatus(broadcast = True):
    global socket

    timeElapsed = 0
    curSongLength = 0
    if isPlaying:
        lastSongEndTime = 0 if curSong == 0 else tracksInfo[curSong-1][2]
        timeElapsed = playTime - lastSongEndTime
        curSongLength = tracksInfo[curSong][3]
        
    json = {
        'isPaused': isPaused,
        'isPlaying': isPlaying,
        'curSong': curSong,
        'numTracks': numTracks,
        'timeElapsed': timeElapsed,
        'curSongLength': curSongLength
    }
        
    if broadcast:
        socket.emit('status', json)
    else:
        emit('status', json)

## set up webserver and websockets
app = Flask(__name__)
app.debug = False
app.config['TEMPLATES_AUTO_RELOAD'] = True
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)
socket = SocketIO(app, async_mode='threading')

@app.route('/')
def index():
    return render_template('index.html')

@socket.on('connect')
def ws_connect():
    sendStatus(False)
    print('connected')

@socket.on('disconnect')
def ws_disconnect():
    print('disconnected')

@socket.on('previousSong')
def ws_previousSong():
    changeSong(-1)

@socket.on('nextSong')
def ws_nextSong():
    changeSong(1)

@socket.on('pauseSong')
def ws_pauseSong():
    pauseSong()

@socket.on('eject')
def ws_eject():
    endPlaying()

@socket.on('seek')
def ws_seek(timeDiff):
    seek(timeDiff)

def flaskThread():
    if __name__ == '__main__':
        socket.run(app, "0.0.0.0", port=5000)

webThread = threading.Thread(target=flaskThread, args=[])
webThread.setDaemon(True)
webThread.start()

## checking for CDs
print("Waiting for CD")
try:
    while True:
        if not cd.get_empty():
            print('test')
            numTracks = cd.get_numtracks()
            if numTracks > 0 and not isPlaying:
                print(numTracks)
                ## opens the mplayer
                audioPlayer = subprocess.Popen(["mplayer","-slave","-quiet","-ao", "alsa:device=hw=1.0", "cdda://:1","-cache","1024"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, bufsize=1)
                curSong = 0
                isPlaying = True;
                GPIO.output(playOutput, GPIO.HIGH)
                playStart = time.time()
                tracksInfo = cd.get_all()
                print('Playing audio CD')
                checkSong()
                ## waits for button inputs
                while True:
                    pause_input_state = GPIO.input(pauseInput)
                    next_input_state = GPIO.input(nextInput)
                    prev_input_state = GPIO.input(prevInput)
                    stop_input_state = GPIO.input(stopInput)
                    try:
                        if pause_input_state == False:
                            pauseSong()
                        if next_input_state == False:
                            changeSong(1)
                        if prev_input_state == False:
                            changeSong(-1)
                        if stop_input_state == False or cd.get_empty():
                            endPlaying()
                            break
                    except Exception as e:
                        print(str(e))
                        endPlaying()
                        break
                    time.sleep(0.01)
            else:
                stop_input_state = GPIO.input(stopInput)
                if stop_input_state == False:
                    os.system('eject cdrom')
            time.sleep(0.01)
except:
    endPlaying()
    socket.stop()

