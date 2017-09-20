from threading import Thread, Timer
from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import json
import logging
from classes.MediaPlayer import MediaPlayer
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
    json_obj = json.loads(open('media_player_info_test.json').read())
    Timer(1, lambda json_obj=json_obj: socket.emit('media_player_info', json_obj)).start()
    print('connected')


@socket.on('disconnect')
def ws_disconnect():
    print('disconnected')


@socket.on('previousSong')
def ws_previousSong():
    pass


@socket.on('nextSong')
def ws_nextSong():
    pass


@socket.on('pauseSong')
def ws_pauseSong():
    pass


@socket.on('eject')
def ws_eject():
    pass


@socket.on('seek')
def ws_seek(data):
    print(data)
    pass


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

# Check for CDs
media_player = MediaPlayer()
media_player.try_play_cd() # try to play CD after running the program

# check udev for USB changes (including CD insertion)
udev_context = pyudev.Context()
udev_monitor = pyudev.Monitor.from_netlink(udev_context)
udev_monitor.filter_by(subsystem='block')
for device in iter(udev_monitor.poll, None):
    if device.action == 'change':
        sleep(1)
        media_player.try_play_cd()
