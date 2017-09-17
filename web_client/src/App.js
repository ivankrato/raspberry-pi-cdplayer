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
                <MediaPlayerProgressBar socket={this.socket}/>
                <p className="connection-status">{this.state.connectionStatus}</p>
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
