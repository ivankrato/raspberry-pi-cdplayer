This program was written as a semestral project for the class Operaèní Systémy II (UAI/755) at University of South Bohemia, Czech Republic.

This is a simple CD player for Raspberry Pi. You need to have external USB CD drive and external USB sound card.

To run the script you need to install mplayer (apt-get install mplayer), flask (pip install flask), flask_socketio (pip install flask_socketio) and probably other things if you're not on Raspbian.

The player can be controlled by buttons (see below) or from a website. The webserver runs on port 5000.

![my setup](/setup.jpg?raw=true)