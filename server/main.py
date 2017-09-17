from threading import Thread, Timer
from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import json
import logging

# Web server configuration
app = Flask(__name__, template_folder=".", static_folder=".")
app.debug = False
app.config['TEMPLATES_AUTO_RELOAD'] = True
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)
socket = SocketIO(app, async_mode='threading')


@socket.on('connect')
def ws_connect():
    emit('status', 'connected')
    json_obj = json.loads(open('media_player_info_test.json').read())
    Timer(5, lambda json_obj=json_obj: socket.emit('media_player_info', json_obj)).start()
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
"""
web_server_thread = Thread(target=start_web_server, args=[])
web_server_thread.setDaemon(True)
web_server_thread.start()
"""
start_web_server()
