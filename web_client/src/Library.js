import React, {Component} from 'react';
import {TrackInfo} from './Helpers';
import FontAwesome from 'react-fontawesome';

export default class Library extends Component {
    constructor(props) {
        super(props);
        this.state = {
            currentBranch: 'artists',
            library: {}
        };

        this.props.socket.subscribeToEvent('media_player_info', (data) => {
                if (data.status === 'waitingForCD') {
                    this.setState({
                        library: {}
                    });
                    return;
                }
                if (data.library) {
                    this.setState({
                        library: data.library
                    });
                }
            }
        );

        this.handleBranchClick = this.handleBranchClick.bind(this);
    }

    handleBranchClick(branch) {
        this.setState({
            currentBranch: branch
        });
    }

    updateHeight() {
        let library = this.refs.library;
        if (window.innerWidth >= 1024) {
            library.style.height = window.innerHeight - library.offsetTop + 'px';
        } else {
            let height = window.innerHeight;
            for(let node of library.parentNode.childNodes) {
                if(node === library) continue;
                height -= node.offsetHeight ;
            }
            library.style.height = height + 'px';
        }
    }

    componentDidUpdate() {
        this.updateHeight();
    }

    componentDidMount() {
        window.addEventListener('resize', this.updateHeight.bind(this));
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
            <div className="resp-library-container">
                <div className="library-container col-50">
                    <ul className="branches">
                        <li onClick={() => this.handleBranchClick('artists')} className={this.state.currentBranch === 'artists' ? 'active' : ''}>Artists</li>
                        <li onClick={() => this.handleBranchClick('folders')} className={this.state.currentBranch === 'folders' ? 'active' : ''}>Folders</li>
                    </ul>
                    <div className="library" ref="library">
                        {list}
                    </div>
                </div>
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
        this.handlePlayClick = this.handlePlayClick ? this.handlePlayClick.bind(this) : undefined;
    }

    handleToggleClick() {
        this.setState({
            collapsed: !this.state.collapsed
        })
    }
}

class Folder extends Branch {
    handlePlayClick() {
        this.props.socket.emit('playFolder', {
            folderIndex: this.props.folderIndex
        })
    }

    render() {
        return (
            <div className={this.state.collapsed ? 'folder branch' : 'folder branch opened'}>
                <span onClick={this.handleToggleClick}>{this.props.name}</span>
                <button className="play-button" onClick={this.handlePlayClick}><FontAwesome name="play" fixedWidth={true}/></button>
                <ol>
                    {this.props.files.map((file, fileIndex) => {
                        let trackInfo = new TrackInfo(file);
                        return (
                            <LibraryFile key={fileIndex} mediaLibraryType="folders" trackInfo={trackInfo} folderIndex={this.props.folderIndex} fileIndex={fileIndex} socket={this.props.socket}/>
                        )
                    })}
                </ol>
            </div>
        )
    }
}

class Artist extends Branch {
    handlePlayClick() {
        this.props.socket.emit('playArtist', {
            artistIndex: this.props.artistIndex,
        })
    }

    render() {
        return (
            <div className={this.state.collapsed ? 'artist branch' : 'artist branch opened'}>
                <span onClick={this.handleToggleClick}>{this.props.name}</span>
                <button className="play-button" onClick={this.handlePlayClick}><FontAwesome name="play" fixedWidth={true}/></button>
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
    handlePlayClick() {
        this.props.socket.emit('playAlbum', {
            artistIndex: this.props.artistIndex,
            albumIndex: this.props.albumIndex
        })
    }

    render() {
        return (
            <div className={this.state.collapsed ? 'album branch' : 'album branch opened'}>
                <span onClick={this.handleToggleClick}>{this.props.name}</span>
                <button className="play-button" onClick={this.handlePlayClick}><FontAwesome name="play" fixedWidth={true}/></button>
                <ol>
                    {this.props.songs.map((song, songIndex) => {
                        let trackInfo = new TrackInfo(song);
                        return (
                            <LibraryFile key={songIndex} mediaLibraryType="albums" trackInfo={trackInfo} artistIndex={this.props.artistIndex} albumIndex={this.props.albumIndex} fileIndex={songIndex} listArtist={false} socket={this.props.socket}/>
                        )
                    })}
                </ol>
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
            'mediaLibraryType': this.props.mediaLibraryType,
            'indexes': [this.props.folderIndex, this.props.artistIndex, this.props.albumIndex, this.props.fileIndex]
        });
    }

    render() {
        return (
            <li onClick={this.handleClick} className="song">
                <span>{this.props.trackInfo.getTrackTitleInfo(this.props.listArtist)} ({this.props.trackInfo.getTotalTimeString()})</span>
            </li>
        )
    }
}