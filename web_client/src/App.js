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
            mediaPlayerStatus: 'Loading'
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
        );
    }

    render() {
        return (
            <div className="media-player">
                <p className="media-player-status">{this.state.mediaPlayerStatus}</p>
                <MediaPlayerMediaInfo socket={this.socket}/>
                <MediaPlayerProgressBar socket={this.socket}/>
                <p className="connection-status">{this.state.connectionStatus}</p>
            </div>
        )
    }
}

class MediaPlayerMediaInfo extends Component {
    constructor(props) {
        super(props);
        this.state = {
            curTime: 0,
            totalTime: 0,
            trackNumber: 0,
            totalTracks: 0,
            artist: '',
            album: '',
            title: ''
        };
        this.props.socket.subscribeToEvent('media_player_info', (data) => {
            const curTrackInfo = data.cur_track_info;
            this.setState({
                curTime: curTrackInfo.cur_time || this.state.curTime,
                totalTime: curTrackInfo.total_time || this.state.totalTime,
                trackNumber: curTrackInfo.track_number || this.state.trackNumber,
                totalTracks: data.track_list ? data.track_list.length : this.state.trackNumber,
                artist: curTrackInfo.artist || this.state.artist,
                album: curTrackInfo.album || this.state.album,
                title: curTrackInfo.title || this.state.title
            });
        });
    }

    getTimeWithLeadingZeros() {
        let curTime = new Date(this.state.curTime);
        curTime = ('0' + curTime.getMinutes()).slice(-2) + ':' + ('0' + curTime.getSeconds()).slice(-2);
        let totalTime = new Date(this.state.totalTime);
        totalTime = ('0' + totalTime.getMinutes()).slice(-2) + ':' + ('0' + totalTime.getSeconds()).slice(-2);
        return curTime + '/' + totalTime;
    }

    getTrackTitleInfo() {
        return this.state.artist ? this.state.artist + ' - ' + this.state.title : this.state.title;
    }

    render() {
        const list = [];
        if(this.state.album) list.push(<li>Album: {this.state.album}</li>);
        if(this.state.title) list.push(<li>{this.getTrackTitleInfo()}</li>);
        list.push(<li>{this.state.trackNumber}/{this.state.totalTracks}</li>);
        list.push(<li>{this.getTimeWithLeadingZeros()}</li>);
        return (
            <div className="media-info">
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
            let track_info = data.cur_track_info;
            if(track_info) {
                progress = Math.round(track_info.cur_time*100/track_info.total_time)
            }
            this.setState({
                progress: progress
            })
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
