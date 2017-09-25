from threading import Thread, Timer
from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import json
import logging
from classes.MediaPlayer import MediaPlayer
from classes.MediaLibrary import MediaLibrary
from time import sleep

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


@socket.on('connect')
def ws_connect():
    emit('status', 'connected')
    socket.emit('media_player_info', media_player.get_current_info(False, False, True, True).as_dict())
    sleep(0.2)
    socket.emit('media_player_info', media_player.get_current_info().as_dict())
    """
    media_library = MediaLibrary()
    media_library.init('D:\OneDrive\Hudba\Arjen Anthony Lucassen')

    json_obj = json.loads(open('media_player_info_test.json').read())
    Timer(1, lambda json_obj=json_obj: socket.emit('media_player_info', json_obj)).start()

    json_obj = {
        'library': media_library.as_dict()
    }
    Timer(2, lambda json_obj=json_obj: socket.emit('media_player_info', json_obj)).start()
    """
    print('connected')


@socket.on('disconnect')
def ws_disconnect():
    print('disconnected')


@socket.on('getCurTrackInfo')
def ws_get_current_track_info():
    socket.emit('media_player_info', media_player.get_current_info(True, True, True, True).as_dict())
    print('getCurTrackInfo')


@socket.on('playFile')
def ws_play_file(data):
    print(data)


@socket.on('playTrack')
def ws_play_track(data):
    print(data)


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
    media_player.play()
    print('play')


@socket.on('pause')
def ws_pause():
    media_player.pause()
    print('pause')


@socket.on('eject')
def ws_eject():
    print('eject')


@socket.on('seek')
def ws_seek(data):
    print('seek: ' + str(data))


def media_player_info_loop(media_player):
    while media_player.is_running:
        for info in iter(media_player.poll_info, None):
            print(info.as_dict())
            socket.emit('media_player_info', info.as_dict())
        sleep(0.1)



# Web server thread starting point
def start_web_server():
    """
    Starts web server
    :return: None
    """
    if __name__ == '__main__':
        socket.run(app, "0.0.0.0", port=5123)


# start_web_server()

# Start web server thread
web_server_thread = Thread(target=start_web_server, args=[])
web_server_thread.setDaemon(True)
web_server_thread.start()

# Check for CDs
media_player = MediaPlayer()
media_player.try_play_cd() # try to play CD after running the program
media_player_info_loop(media_player)

# check udev for USB changes (including CD insertion)
udev_context = pyudev.Context()
udev_monitor = pyudev.Monitor.from_netlink(udev_context)
udev_monitor.filter_by(subsystem='block')
for device in iter(udev_monitor.poll, None):
    if device.action == 'change':
        sleep(1)
        media_player.try_play_cd()
        media_player_info_loop(media_player)
                

