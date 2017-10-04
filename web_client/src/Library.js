import React, {Component} from 'react';
import {TrackInfo} from './Helpers';

export default class Library extends Component {
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
        });
    }

    handleFoldersClick() {
        this.setState({
            currentBranch: 'folders'
        });
    }

    componentDidUpdate() {
        function height() {
            let library = this.refs.library;
            library.style.height = window.innerHeight - library.offsetTop + 'px';
        }
        height.bind(this)();
        window.addEventListener('resize', height.bind(this));
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
            <div className="library" ref="library">
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
                {this.props.trackInfo.getTrackTitleInfo(this.props.listArtist)} ({this.props.trackInfo.getTotalTimeString()})
            </li>
        )
    }
}