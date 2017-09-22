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
            trackList: [],
        };
        this.socket = new Socket('http://localhost:5123'); //TODO change URL to window.location.href

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
                    })
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
                    <ConnectionStatus socket={this.socket}/>
                </div>
                <div className="clearfix"/>
                <Library socket={this.socket}/>
            </div>
        )
    }
}

class Status extends Component {
    render() {
        return (
            <p className={this.className || ''}>{this.state.text}</p>
        );
    }
}

class MediaPlayerStatus extends Status {
    constructor(props) {
        super(props);
        this.className = 'media-player-status';
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
        this.className = 'connection-status';
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

class CurrentTrackInfo extends Component {
    constructor(props) {
        super(props);

        this.state = {
            curTime: 0,
            trackNumber: 0,
            totalTracks: 1,
            mediaInfo: new TrackInfo()
        };
        this.interval = undefined;
        this.props.socket.subscribeToEvent('media_player_info', (data) => {
            const curTrackInfo = data.cur_track_info;
            if (curTrackInfo) {
                let mediaInfo = curTrackInfo.track_number !== undefined ? this.props.trackList[curTrackInfo.track_number] : this.state.mediaInfo;
                this.setState({
                    trackNumber: curTrackInfo.track_number || this.state.trackNumber,
                    curTime: curTrackInfo.cur_time,
                    totalTracks: this.props.trackList.length,
                    mediaInfo: mediaInfo,
                });
                if(this.interval) clearInterval(this.interval);
                this.interval = setInterval(() => {
                    this.setState({
                        curTime: this.state.curTime + 100
                    });
                    if(this.state.curTime > mediaInfo.totalTime) {
                        this.props.socket.emit('getCurTrackInfo');
                        setTimeout(() => {this.props.socket.emit('getCurTrackInfo')}, 1000);
                    }
                }, 100)
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
                this.setState({
                    progress: Math.round(curTrackInfo.cur_time * 100 / mediaInfo.totalTime),
                    curTime: curTrackInfo.cur_time
                });
                if(this.interval) clearInterval(this.interval);
                this.interval = setInterval(() => {
                    this.setState({
                        progress: Math.round((this.state.curTime + 100) * 100 / mediaInfo.totalTime),
                        curTime: this.state.curTime + 100
                    });
                    if(this.state.curTime > mediaInfo.totalTime) {
                        this.props.socket.emit('getCurTrackInfo');
                        setTimeout(() => {this.props.socket.emit('getCurTrackInfo')}, 1000);
                    }
                }, 100)
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

class Library extends Component {
    constructor(props) {
        super(props);
        this.state = {
            currentBranch: 'artists',
            library: {}
        };

        this.props.socket.subscribeToEvent('media_player_info', (data) => {
                if (data.library) {
                    this.setState({
                        library: data.library
                    });
                }
            }
        );

        this.ulStyle = {display: 'none'};

        this.handleArtistsClick = this.handleArtistsClick.bind(this);
        this.handleFoldersClick = this.handleFoldersClick.bind(this);
    }

    handleArtistsClick() {
        this.setState({
            currentBranch: 'artists'
        });
    }

    handleFoldersClick() {
        this.setState({
            currentBranch: 'folders'
        });
    }

    render() {
        let list = null;
        switch (this.state.currentBranch) {
            case 'artists':
                let artists = this.state.library.artists || [];
                list = (
                    <div className={"artists"}>
                        <ul>
                            {artists.map((artist, artistIndex) =>
                                <li key={artistIndex}>
                                    <Artist name={artist.name} albums={artist.albums || []} artistIndex={artistIndex} socket={this.props.socket}/>
                                </li>
                            )}
                        </ul>
                    </div>
                );
                break;
            case 'folders':
                let folders = this.state.library.media_folders || [];
                list = (
                    <div className="folders">
                        <ul>
                            {folders.map((folder, folderIndex) => {
                                return (
                                    <li key={folderIndex}>
                                        <Folder name={folder.name} files={folder.media_files || []} folderIndex={folderIndex} socket={this.props.socket}/>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                );
                break;
            default:
                // do nothing
                break;
        }

        return (
            <div className="library">
                <button onClick={this.handleArtistsClick}>Artists</button>
                <button onClick={this.handleFoldersClick}>Folders</button>
                {list}
            </div>
        )
    }
}

class Branch extends Component {
    constructor(props) {
        super(props);
        this.state = {
            collapsed: true
        };
        this.handleToggleClick = this.handleToggleClick.bind(this);
    }

    handleToggleClick() {
        this.setState({
            collapsed: !this.state.collapsed
        })
    }
}

class Folder extends Branch {
    render() {
        return (
            <div className={this.state.collapsed ? 'folder branch' : 'folder branch opened'}>
                {this.props.name}
                <button onClick={this.handleToggleClick}>Toggle</button>
                <ul>
                    {this.props.files.map((file, fileIndex) =>
                        <LibraryFile key={fileIndex} type="folderFile" artist={file.artist} title={file.title} folderIndex={this.props.folderIndex} fileIndex={fileIndex} socket={this.props.socket}/>
                    )}
                </ul>
            </div>
        )
    }
}

class Artist extends Branch {
    render() {
        return (
            <div className={this.state.collapsed ? 'artist branch' : 'artist branch opened'}>
                {this.props.name}
                <button onClick={this.handleToggleClick}>Toggle</button>
                <ul>
                    {this.props.albums.map((album, albumIndex) =>
                        <li key={albumIndex}>
                            <Album name={album.name} songs={album.songs || []} albumIndex={albumIndex} artistIndex={this.props.artistIndex} socket={this.props.socket}/>
                        </li>
                    )}
                </ul>
            </div>
        )
    }
}

class Album extends Branch {
    render() {
        return (
            <div className={this.state.collapsed ? 'album branch' : 'album branch opened'}>
                {this.props.name}
                <button onClick={this.handleToggleClick}>Toggle</button>
                <ul>
                    {this.props.songs.map((song, songIndex) =>
                        <LibraryFile key={songIndex} type="artistFile" title={song.title} artistIndex={this.props.artistIndex} albumIndex={this.props.albumIndex} fileIndex={songIndex} socket={this.props.socket}/>
                    )}
                </ul>
            </div>
        )
    }
}

class LibraryFile extends Component {
    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick() {
        this.props.socket.emit('playFile', {
            'type': this.props.type,
            'folderIndex': this.props.folderIndex,
            'artistIndex': this.props.artistIndex,
            'albumIndex': this.props.albumIndex,
            'fileIndex': this.props.fileIndex
        });
    }

    render() {
        let str = this.props.fileIndex + ' - ' + (this.props.artist ? this.props.artist + ' - ' : '') + this.props.title;
        return (
            <li onClick={this.handleClick}>
                {str}
            </li>
        )
    }
}

export default App;
