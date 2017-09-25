import React, {Component} from 'react';
import {Socket, TrackInfo} from './Helpers';
import Library from './Library';
import TrackList from './TrackList';
import Controls from './Controls';

export default class MediaPlayer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            connectionStatus: 'Not connected',
            mediaPlayerStatus: 'Loading',
            trackList: [],
        };
        this.socket = new Socket('http://192.168.1.24:5123'); //TODO change URL to window.location.href

        /*
         * MEDIAPLAYER EVENTS
         */
        this.socket.subscribeToEvent('media_player_info', (data) => {
                if (data.track_list) {
                    let trackList = [];
                    for (let track of data.track_list) {
                        trackList.push(new TrackInfo(track));
                    }
                    this.setState({
                        trackList: trackList
                    });
                }
            }
        );
    }

    render() {
        return (
            <div className="media-player-container">
                <div className="media-player">
                    <MediaPlayerStatus socket={this.socket}/>
                    <CurrentTrackInfo socket={this.socket} trackList={this.state.trackList}/>
                    <ProgressBar socket={this.socket} trackList={this.state.trackList}/>
                    <Controls socket={this.socket} />
                    <ConnectionStatus socket={this.socket}/>
                </div>
                <div className="row">
                    <div className="col-50">
                        <Library socket={this.socket}/>
                    </div>
                    <div className="col-50">
                        <TrackList socket={this.socket}/>
                    </div>
                </div>
            </div>
        )
    }
}

class Status extends Component {
    render() {
        return (
            <p className={this.type || ''}>{this.state.text}</p>
        );
    }
}

class MediaPlayerStatus extends Status {
    constructor(props) {
        super(props);
        this.type = 'media-player-status';
        this.state = {
            text: 'Loading...'
        };

        this.props.socket.subscribeToEvent('media_player_info', (data) => {
                if (data.status) {
                    let text;
                    switch (data.status) {
                        case 'playing':
                            text = 'Playing media';
                            break;
                        case 'paused':
                            text = 'Media paused';
                            break;
                        case 'waitingForCD':
                            text = 'Waiting for CD';
                            break;
                        default:
                            text = 'Unspecified status';
                    }
                    this.setState({
                        text: text
                    })
                }
            }
        );
    }
}

class ConnectionStatus extends Status {
    constructor(props) {
        super(props);
        this.type = 'connection-status';
        this.state = {
            text: 'Not connected'
        };

        /*
         * SOCKET.IO EVENTS
         */
        for (let event of ['connect', 'reconnect']) {
            this.props.socket.subscribeToEvent(event, () => this.setState({
                text: 'Connected'
            }));
        }
        for (let event of ['reconnecting', 'reconnect_error']) {
            this.props.socket.subscribeToEvent(event, () => this.setState({
                text: 'Reconnecting'
            }));
        }
        for (let event of ['connect_timeout', 'disconnect']) {
            this.props.socket.subscribeToEvent(event, () => this.setState({
                text: 'Disconnected'
            }));
        }
        for (let event of ['connect_error', 'error', 'reconnect_error', 'reconnect_failed']) {
            this.props.socket.subscribeToEvent(event, () => this.setState({
                text: 'Connection error'
            }));
        }
    }
}

class CurrentTrackInfo extends Component {
    constructor(props) {
        super(props);

        this.state = {
            curTime: 0,
            trackNumber: 0,
            totalTracks: 1,
            trackInfo: new TrackInfo()
        };
        this.interval = undefined;
        this.props.socket.subscribeToEvent('media_player_info', (data) => {
            const curTrackInfo = data.cur_track_info;
            if (curTrackInfo) {
                let trackInfo = curTrackInfo.track_number !== undefined ? this.props.trackList[curTrackInfo.track_number] : this.state.trackInfo;
                if(trackInfo) {
                    this.setState({
                        trackNumber: curTrackInfo.track_number || this.state.trackNumber,
                        curTime: curTrackInfo.cur_time,
                        totalTracks: this.props.trackList.length,
                        trackInfo: trackInfo || this.state.trackInfo
                    });
                    if (this.interval) clearInterval(this.interval);
                    this.interval = setInterval(() => {
                        this.setState({
                            curTime: this.state.curTime + 100
                        });
                        if (this.state.curTime > trackInfo.totalTime) {
                            if (this.interval) clearInterval(this.interval);
                            this.props.socket.emit('getCurTrackInfo');
                            setTimeout(() => {
                                this.props.socket.emit('getCurTrackInfo')
                            }, 1000);
                        }
                    }, 100)
                }
            }
        });
    }

    render() {
        const list = [];
        list.push(<li key="title">{this.state.trackInfo.getTrackTitleInfo()}</li>);
        list.push(<li key="album">Album: {this.state.trackInfo.album}</li>);
        list.push(<li key="number">{this.state.trackNumber + 1}/{this.state.totalTracks}</li>);
        list.push(<li key="time">{this.state.trackInfo.getTimeWithLeadingZeros(this.state.curTime)}</li>);
        return (
            <div className="current-track-info">
                <ul>
                    {list}
                </ul>
            </div>
        )
    }
}

class ProgressBar extends Component {
    constructor(props) {
        super(props);
        this.state = {
            progress: 0,
            curTime: 0
        };
        this.interval = undefined;
        this.props.socket.subscribeToEvent('media_player_info', (data) => {
            let curTrackInfo = data.cur_track_info;
            if (curTrackInfo) {
                let mediaInfo = this.props.trackList[curTrackInfo.track_number];
                if(mediaInfo) {
                    this.setState({
                        progress: Math.round(curTrackInfo.cur_time * 100 / mediaInfo.totalTime),
                        curTime: curTrackInfo.cur_time
                    });
                    if (this.interval) clearInterval(this.interval);
                    this.interval = setInterval(() => {
                        this.setState({
                            progress: Math.round((this.state.curTime + 100) * 100 / mediaInfo.totalTime),
                            curTime: this.state.curTime + 100,
                        });
                        if (this.state.curTime > mediaInfo.totalTime) {
                            if (this.interval) clearInterval(this.interval);
                            this.props.socket.emit('getCurTrackInfo');
                            setTimeout(() => {
                                this.props.socket.emit('getCurTrackInfo')
                            }, 1000);
                        }
                    }, 100)
                }
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

