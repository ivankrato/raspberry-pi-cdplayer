import openSocket from 'socket.io-client';

export default class Socket {
    constructor(url) {
        this.socket = openSocket(url);
    }

    subscribeToEvent(eventName, callback) {
        this.socket.on(eventName, data => callback(data));
    }

    emit(eventName, data) {
        this.socket.emit(eventName, data);
    }
}