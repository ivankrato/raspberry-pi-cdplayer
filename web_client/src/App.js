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
                <Library socket={this.socket} />
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
        this.props.socket.subscribeToEvent('media_player_info', (data) => {
            const curTrackInfo = data.cur_track_info;
            if (curTrackInfo) {
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

class ProgressBar extends Component {
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

        this.handleArtistsClick = this.handleArtistsClick.bind(this);
        this.handleFoldersClick = this.handleFoldersClick.bind(this);
    }

    handleArtistsClick() {
        this.setState({
            currentBranch: 'artists'
        })
    }

    handleFoldersClick() {
        this.setState({
            currentBranch: 'folders'
        })
    }

    render() {
        let branch = null;
        switch (this.state.currentBranch) {
            case 'artists':
                branch = (<ArtistsBranch library={this.state.library}/>);
                break;
            case 'folders':
                branch = (<FoldersBranch library={this.state.library}/>);
                break;
            default:
                // do nothing
                break;
        }

        return (
            <div className="library">
                <button onClick={this.handleArtistsClick}>Artists</button>
                <button onClick={this.handleFoldersClick}>Folders</button>
                {branch}
            </div>
        )
    }
}

//TODO remove and do statically in Library

class LibraryBranch extends Component {
    constructor(props) {
        super(props);
        this.itemList = [];
    }

    render() {
        return (
            <div className="branch">
                {this.name}
                <ul>{this.itemList}</ul>
            </div>
        )
    }
}

class LibraryFile extends Component {
    render() {
        return (
            <li>
                {this.props.number} - {this.props.title}
            </li>
        )
    }
}

class FoldersBranch extends LibraryBranch {
    constructor(props) {
        super(props);
        let folders = this.props.library.media_folders;
        if (folders && folders.length > 0) {
            for (let [index, folder] of folders.entries()) {
                this.itemList.push(<li key={index}><Folder folder={folder}/></li>);
            }
        }
    }
}

class Folder extends LibraryBranch {
    constructor(props) {
        super(props);
        this.name = this.props.folder.name;
        let files = this.props.folder.media_files;
        if (files && files.length > 0) {
            for (let [index, file] of files.entries()) {
                this.itemList.push(<LibraryFile key={index} title={file.title} number={index}/>)
            }
        }
    }
}

class ArtistsBranch extends LibraryBranch {
    constructor(props) {
        super(props);
        let artists = this.props.library.artists;
        if (artists && artists.length > 0) {
            for (let [index, artist] of artists.entries()) {
                this.itemList.push(<li key={index}><Artist artist={artist}/></li>);
            }
        }
    }
}

class Artist extends LibraryBranch {
    constructor(props) {
        super(props);
        this.name = this.props.artist.name;
        let albums = this.props.artist.albums;
        if (albums && albums.length > 0) {
            for (let [index, album] of albums.entries()) {
                this.itemList.push(<li key={index}><Album album={album}/></li>);
            }
        }
    }
}

class Album extends LibraryBranch {
    constructor(props) {
        super(props);
        this.name = this.props.album.name;
        let songs = this.props.album.songs;
        if (songs && songs.length > 0) {
            for (let [index, song] of songs.entries()) {
                this.itemList.push(<LibraryFile key={index} title={song.title} number={index}/>)
            }
        }
    }
}

export default App;
