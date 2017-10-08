import React, {Component} from 'react';
import {Socket, TrackInfo} from './Helpers';
import Library from './Library';
import TrackList from './TrackList';
import Controls from './Controls';

// TODO reset while waiting for CD

export default class MediaPlayer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            connectionStatus: 'Not connected',
            mediaPlayerStatus: 'Loading',
            trackList: [],
        };
        this.socket = new Socket('http://192.168.0.108:5123'); //TODO change URL to window.location.href

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

        this.handleLibraryRespCheckboxChange = this.handleLibraryRespCheckboxChange.bind(this);
        this.handleTrackListRespCheckboxChange = this.handleTrackListRespCheckboxChange.bind(this);
    }



    handleLibraryRespCheckboxChange() {
        this.refs.trackListRespCheckbox.checked = false;
    }

    handleTrackListRespCheckboxChange() {
        this.refs.libraryRespCheckbox.checked = false;
    }
    render() {
        return (
            <div className="media-player-container">
                <div className="media-player">
                    <div className="clearfix">
                        <MediaPlayerStatus socket={this.socket}/>
                        <ConnectionStatus socket={this.socket}/>
                    </div>
                    <CurrentTrackInfo socket={this.socket} trackList={this.state.trackList}/>
                    <ProgressBar socket={this.socket} trackList={this.state.trackList}/>
                    <Controls socket={this.socket}/>
                </div>
                <div className="row">
                    <input ref="libraryRespCheckbox" onChange={this.handleLibraryRespCheckboxChange} type="checkbox" className="resp-toggle" id="resp-toggle-library" />
                    <label htmlFor="resp-toggle-library"></label>
                    <Library socket={this.socket} className="col-50" onBlur={this.hideLibraryTrackList}/>
                    <input ref="trackListRespCheckbox" onChange={this.handleTrackListRespCheckboxChange} type="checkbox" className="resp-toggle" id="resp-toggle-track-list" />
                    <label htmlFor="resp-toggle-track-list"></label>
                    <TrackList socket={this.socket} className="col-50"/>
                </div>
            </div>
        )
    }
}

class Status extends Component {
    render() {
        return (
            <span className={this.type || ''}>{this.state.text}</span>
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
            trackInfo: new TrackInfo(),
            playing: false
        };
        this.interval = undefined;
        this.props.socket.subscribeToEvent('media_player_info', (data) => {
            if (data.status === 'waitingForCD') {
                clearInterval(this.interval);
                this.setState({
                    playing: false
                });
                return;
            }
            const curTrackInfo = data.cur_track_info;
            if (curTrackInfo) {
                let trackInfo = curTrackInfo.track_number !== undefined ? this.props.trackList[curTrackInfo.track_number] : this.state.trackInfo;
                if (trackInfo) {
                    this.setState({
                        trackNumber: curTrackInfo.track_number === undefined ? this.state.trackNumber : curTrackInfo.track_number,
                        curTime: curTrackInfo.cur_time,
                        totalTracks: this.props.trackList.length,
                        trackInfo: trackInfo || this.state.trackInfo,
                        playing: true
                    });
                    clearInterval(this.interval);
                    this.interval = setInterval(() => {
                        this.setState({
                            curTime: this.state.curTime + 100
                        });
                        if (this.state.curTime > trackInfo.totalTime) {
                            clearInterval(this.interval);
                            this.props.socket.emit('getCurTrackInfo');
                            setTimeout(() => {
                                this.props.socket.emit('getCurTrackInfo')
                            }, 1000);
                        }
                    }, 100)
                }
            }
            if (data.status === 'paused') {
                clearInterval(this.interval);
            }
        });
    }

    render() {
        return (
            <div className="current-track-info">
                <div className="title">{this.state.trackInfo.getTrackTitleInfo()}</div>
                <div className="album">Album: {this.state.trackInfo.album}</div>
                <div className="clearfix">
                    <div className="time">{this.state.trackInfo.getTimeWithLeadingZeros(this.state.curTime)}</div>
                    <div className="number">{this.state.trackNumber + 1}/{this.state.totalTracks}</div>
                </div>
            </div>
        )
    }
}

class ProgressBar extends Component {
    constructor(props) {
        super(props);
        this.state = {
            progress: 0,
            curTime: 0,
            playing: false
        };
        this.interval = undefined;
        this.props.socket.subscribeToEvent('media_player_info', (data) => {
            if (data.status === 'waitingForCD') {
                clearInterval(this.interval);
                this.setState({
                    playing: false
                });
                return;
            }
            const curTrackInfo = data.cur_track_info;
            if (curTrackInfo) {
                let mediaInfo = this.props.trackList[curTrackInfo.track_number];
                if (mediaInfo) {
                    this.setState({
                        progress: Math.round(curTrackInfo.cur_time * 100 / mediaInfo.totalTime),
                        curTime: curTrackInfo.cur_time,
                        playing: true
                    });
                    clearInterval(this.interval);
                    this.interval = setInterval(() => {
                        this.setState({
                            progress: Math.round((this.state.curTime + 100) * 100 / mediaInfo.totalTime),
                            curTime: this.state.curTime + 100
                        });
                        if (this.state.curTime > mediaInfo.totalTime) {
                            clearInterval(this.interval);
                            this.props.socket.emit('getCurTrackInfo');
                            setTimeout(() => {
                                this.props.socket.emit('getCurTrackInfo')
                            }, 1000);
                        }
                    }, 100)
                }
            }
            if (data.status === 'paused') {
                clearInterval(this.interval);
            }
        });

        this.handleSeekerClick = this.handleSeekerClick.bind(this)
        this.handleSeekerMouseMove = this.handleSeekerMouseMove.bind(this);
        this.handleSeekerMouseOut = this.handleSeekerMouseOut.bind(this);
    }

    handleSeekerClick(e) {
        let x = e.nativeEvent.offsetX;
        let width = this.refs.seeker.offsetWidth;
        let seek = Math.round(x * 100 / width);
        this.props.socket.emit('seek', {
            'seekPercent': seek
        });
    }

    handleSeekerMouseMove(e) {
        let x = e.nativeEvent.offsetX;
        let width = this.refs.seeker.offsetWidth;
        this.refs.seekerHover.style.display = 'block';
        this.refs.seekerHover.style.left = x + 'px';
        if(x < this.state.progress/100 * width) {
            this.refs.seekerHover.classList.add('white');
        } else {
            this.refs.seekerHover.classList.remove('white');
        }
    }

    handleSeekerMouseOut(e) {
        this.refs.seekerHover.style.display = 'none'
    }

    render() {
        let progressBarStyle = {
            width: this.state.playing ? this.state.progress + '%' : 0
        };
        return (
            <div ref="seeker" className="progress-bar-container">
                <div className="progress-bar" style={progressBarStyle}/>
                <div ref="seeker" className="seeker" onClick={this.handleSeekerClick} onMouseMove={this.handleSeekerMouseMove} onMouseOut={this.handleSeekerMouseOut}/>
                <div ref="seekerHover" className="seeker-hover" />
            </div>
        )
    }
}

