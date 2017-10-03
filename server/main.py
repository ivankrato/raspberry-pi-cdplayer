from threading import Thread, Timer
from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import json
import logging
from classes.MediaPlayer import MediaPlayer
from classes.MediaLibrary import MediaLibrary
from time import sleep

has_pi_face_cad = True

try:
    from classes.MediaPlayerPiFaceCAD import MediaPlayerPiFaceCAD
except ImportError:
    print('NO PIFACE CAD LIBRARY INSTALLED')
    has_pi_face_cad = False

import pyudev

# Web server configuration
app = Flask(__name__, template_folder=".", static_folder=".")
app.debug = False
app.config['TEMPLATES_AUTO_RELOAD'] = True
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)
socket = SocketIO(app, async_mode='threading')


@app.route('/')
def index():
    return 'test'

for event in ['connect', 'reconnect']:
    @socket.on(event)
    def ws_connect():
        emit('status', 'connected')
        socket.emit('media_player_info', media_player.get_current_info(False, False, True, True).as_dict())
        sleep(1)
        socket.emit('media_player_info', media_player.get_current_info().as_dict())
        print('connected')


@socket.on('disconnect')
def ws_disconnect():
    print('disconnected')


@socket.on('getCurTrackInfo')
def ws_get_current_track_info():
    socket.emit('media_player_info', media_player.get_current_info(True, True, True, True).as_dict())


@socket.on('playFile')
def ws_play_file(data):
    media_player.play_file(data['mediaLibraryType'], data['indexes'])


@socket.on('playTrack')
def ws_play_track(data):
    media_player.play_track(data['trackNumber'])


@socket.on('prevBranch')
def ws_prev_branch():
    print('prevBranch')


@socket.on('nextBranch')
def ws_next_branch():
    print('nextBranch')
    pass


@socket.on('prevTrack')
def ws_prev_track():
    media_player.prev_track()
    print('prevTrack')


@socket.on('nextTrack')
def ws_next_track():
    media_player.next_track()
    print('nextTrack')


@socket.on('play')
def ws_play():
    media_player.play_pause()
    print('play')


@socket.on('pause')
def ws_pause():
    media_player.play_pause()
    print('pause')


@socket.on('eject')
def ws_eject():
    media_player.stop()


@socket.on('seek')
def ws_seek(data):
    media_player.seek(data['seekPercent'])


def play_cd(media_player):
    media_player.try_play_cd()  # try to play CD after running the program
    cad = None
    if media_player.is_running:
        if has_pi_face_cad:
            cad = MediaPlayerPiFaceCAD(media_player)
        while media_player.is_running:
            for info in iter(media_player.poll_info, None):
                print(info.as_dict())
                socket.emit('media_player_info', info.as_dict())
            if cad is not None:
                cad.write_info(media_player.get_current_info())
            sleep(0.2)
        cad.destroy()
        # FIXME this doesn't get emitted
        socket.emit('media_player_info', media_player.get_current_info(True, False, False, False).as_dict())


# Web server thread starting point
def start_web_server():
    """
    Starts web server
    :return: None
    """
    if __name__ == '__main__':
        socket.run(app, "0.0.0.0", port=5123)


# Start web server thread
web_server_thread = Thread(target=start_web_server, args=[])
web_server_thread.setDaemon(True)
web_server_thread.start()

media_player = MediaPlayer()

# Eject button
eject_listener = MediaPlayerPiFaceCAD.create_eject_listener(media_player)

play_cd(media_player)

# check udev for USB changes (including CD insertion)
udev_context = pyudev.Context()
udev_monitor = pyudev.Monitor.from_netlink(udev_context)
udev_monitor.filter_by(subsystem='block')
for device in iter(udev_monitor.poll, None):
    if device.action == 'change':
        sleep(1)
        play_cd(media_player)
