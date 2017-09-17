import React, {Component} from 'react';
import './App.css';
import Socket from './Socket'

class App extends Component {
    render() {
        return (
            <div className="app">
                <MediaPlayer/>
            </div>
        );
    }
}

class MediaPlayer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            connectionStatus: 'Not connected',
            mediaPlayerStatus: 'Loading',
            trackList: []
        };
        this.socket = new Socket('http://localhost:5123'); //TODO change URL to window.location.href
        /*
         * SOCKET.IO EVENTS
         */
        for (let event of ['connect', 'reconnect']) {
            this.socket.subscribeToEvent(event, () => this.setState({
                connectionStatus: 'Connected'
            }));
        }
        for (let event of ['reconnecting', 'reconnect_error']) {
            this.socket.subscribeToEvent(event, () => this.setState({
                connectionStatus: 'Reconnecting'
            }));
        }
        for (let event of ['connect_timeout', 'disconnect']) {
            this.socket.subscribeToEvent(event, () => this.setState({
                connectionStatus: 'Disconnected'
            }));
        }
        for (let event of ['connect_error', 'error', 'reconnect_error', 'reconnect_failed']) {
            this.socket.subscribeToEvent(event, () => this.setState({
                connectionStatus: 'Connection error'
            }));
        }
        /*
         * MEDIAPLAYER EVENTS
         */
        this.socket.subscribeToEvent('media_player_info', (data) => {
                if (data.status) {
                    let mediaPlayerStatus;
                    switch (data.status) {
                        case 'playing':
                            mediaPlayerStatus = 'Playing media';
                            break;
                        case 'paused':
                            mediaPlayerStatus = 'Media paused';
                            break;
                        case 'waitingForCD':
                            mediaPlayerStatus = 'Waiting for CD';
                            break;
                        default:
                            mediaPlayerStatus = 'Unspecified status';
                    }
                    this.setState({
                        mediaPlayerStatus: mediaPlayerStatus
                    })
                }
                if (data.track_list) {
                    let trackList = [];
                    for (let track of data.track_list) {
                        trackList.push(new TrackInfo(track));
                    }
                    this.setState({
                        trackList: trackList
                    })
                }
            }
        );
    }

    render() {
        return (
            <div className="media-player">
                <p className="media-player-status">{this.state.mediaPlayerStatus}</p>
                <MediaPlayerCurrentTrackInfo socket={this.socket} trackList={this.state.trackList}/>
                <MediaPlayerProgressBar socket={this.socket} trackList={this.state.trackList}/>
                <p className="connection-status">{this.state.connectionStatus}</p>
            </div>
        )
    }
}

class TrackInfo {
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

    getTrackTitleInfo() {
        return this.artist ? this.artist + ' - ' + this.title : this.title;
    }

    getTimeWithLeadingZeros(curTimeMillis) {
        let curTime = new Date(curTimeMillis);
        curTime = ('0' + curTime.getMinutes()).slice(-2) + ':' + ('0' + curTime.getSeconds()).slice(-2);
        let totalTime = new Date(this.totalTime);
        totalTime = ('0' + totalTime.getMinutes()).slice(-2) + ':' + ('0' + totalTime.getSeconds()).slice(-2);
        return curTime + '/' + totalTime;
    }
}

class MediaPlayerCurrentTrackInfo extends Component {
    constructor(props) {
        super(props);

        this.state = {
            curTime: 0,
            trackNumber: 0,
            totalTracks: 1,
            mediaInfo: new TrackInfo()
        };
        this.props.socket.subscribeToEvent('media_player_info', (data) => {
            const curTrackInfo = data.cur_track_info;
            if(curTrackInfo) {
                this.setState({
                    trackNumber: curTrackInfo.track_number || this.state.trackNumber,
                    curTime: curTrackInfo.cur_time || this.state.curTime,
                    totalTracks: this.props.trackList.length,
                    mediaInfo: curTrackInfo.track_number !== undefined ? this.props.trackList[curTrackInfo.track_number] : this.state.mediaInfo,
                });
            }
        });
    }

    render() {
        const list = [];
        if (this.state.mediaInfo.album) list.push(<li key="album">Album: {this.state.mediaInfo.album}</li>);
        if (this.state.mediaInfo.title) list.push(<li key="title">{this.state.mediaInfo.getTrackTitleInfo()}</li>);
        list.push(<li key="number">{this.state.trackNumber + 1}/{this.state.totalTracks}</li>);
        list.push(<li key="time">{this.state.mediaInfo.getTimeWithLeadingZeros(this.state.curTime)}</li>);
        return (
            <div className="current-track-info">
                <ul>
                    {list}
                </ul>
            </div>
        )
    }
}

class MediaPlayerProgressBar extends Component {
    constructor(props) {
        super(props);
        this.state = {
            progress: 0
        };
        this.props.socket.subscribeToEvent('media_player_info', (data) => {
            let progress = 0;
            let curTrackInfo = data.cur_track_info;
            if (curTrackInfo) {
                let trackInfo = this.props.trackList[curTrackInfo.track_number];
                progress = Math.round(curTrackInfo.cur_time * 100 / trackInfo.totalTime);
                this.setState({
                    progress: progress
                })
            }

        });

        this.handleSeekerClick = this.handleSeekerClick.bind(this);
    }

    handleSeekerClick(e) {
        let x = e.nativeEvent.offsetX;
        let width = this.refs.seeker.offsetWidth;
        let seek = Math.round(x * 100 / width);
        this.props.socket.emit('seek', seek);
    }

    render() {
        let progressBarStyle = {
            width: this.state.progress + '%'
        };
        return (
            <div ref="seeker" className="progress-bar-container">
                <div className="progress-bar" style={progressBarStyle}/>
                <div ref="seeker" className="seeker" onClick={this.handleSeekerClick}/>
            </div>
        )
    }
}


export default App;
