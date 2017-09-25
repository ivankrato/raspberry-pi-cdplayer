import openSocket from 'socket.io-client';

export class Socket {
    constructor(url) {
        this.socket = openSocket(url);
    }

    subscribeToEvent(eventName, callback) {
        this.socket.on(eventName, data => callback(data));
    }

    emit(eventName, data) {
        if(data) {
            this.socket.emit(eventName, data)
        } else {
            this.socket.emit(eventName);
        }
    }
}

export class TrackInfo {
    constructor(totalTimeOrJsonTrack = 0, artist = '', album = '', title = '') {
        if (typeof(totalTimeOrJsonTrack) === 'object') {
            this.totalTime = totalTimeOrJsonTrack.total_time;
            this.artist = totalTimeOrJsonTrack.artist;
            this.album = totalTimeOrJsonTrack.album;
            this.title = totalTimeOrJsonTrack.title;
        } else {
            this.totalTime = totalTimeOrJsonTrack;
            this.artist = artist;
            this.album = album;
            this.title = title;
        }
    }

    getTrackTitleInfo(artist = true) {
        return artist && this.artist ? this.artist + ' - ' + this.title : this.title;
    }

    getTotalTimeString() {
        let totalTime = new Date(this.totalTime);
        totalTime = ('0' + totalTime.getMinutes()).slice(-2) + ':' + ('0' + totalTime.getSeconds()).slice(-2);
        return totalTime;
    }

    getTimeWithLeadingZeros(curTimeMillis) {
        let curTime = new Date(curTimeMillis);
        curTime = ('0' + curTime.getMinutes()).slice(-2) + ':' + ('0' + curTime.getSeconds()).slice(-2);
        return curTime + '/' + this.getTotalTimeString();
    }
}