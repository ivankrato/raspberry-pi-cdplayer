import React, {Component} from 'react';
import {TrackInfo} from './Helpers';

export default class TrackList extends Component {
    constructor(props) {
        super(props);
        this.state = {
            curTrackNumber: 0,
            trackList: []
        };

        this.props.socket.subscribeToEvent('media_player_info', (data) => {
            if (data.status === 'waitingForCD') {
                this.setState({
                    trackList: []
                });
                return;
            }
            if (data.track_list) {
                this.setState({
                    trackList: data.track_list.map((track) => {
                        return new TrackInfo(track);
                    })
                });
            }
            if (data.cur_track_info) {
                this.setState({
                    curTrackNumber: data.cur_track_info.track_number === undefined ? this.state.curTrackNumber : data.cur_track_info.track_number
                });
            }
        });
    }

    updateHeight() {
        let trackList = this.refs.trackList;
        if (window.innerWidth >= 1024) {
            trackList.style.height = window.innerHeight - trackList.offsetTop + 'px';
        } else {
            let height = window.innerHeight;
            for (let node of trackList.parentNode.childNodes) {
                if (node === trackList) continue;
                height -= node.offsetHeight;
            }
            trackList.style.height = height + 'px';
        }
    }

    componentDidUpdate() {
        this.updateHeight();
    }

    componentDidMount() {
        window.addEventListener('resize', this.updateHeight.bind(this));
    }

    render() {
        return (
            <div className="resp-track-list-container">
                <div className="track-list-container col-50">
                    <h2>Track list</h2>
                    <div className="track-list" ref="trackList">
                        <ol>
                            {this.state.trackList.map((trackInfo, trackNumber) => {
                                return (
                                    <Track key={trackNumber} trackInfo={trackInfo} trackNumber={trackNumber} socket={this.props.socket} active={trackNumber === this.state.curTrackNumber}/>
                                )
                            })}
                        </ol>
                    </div>
                </div>
            </div>
        )
    }
}

class Track extends Component {
    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick() {
        this.props.socket.emit('playTrack', {
            'trackNumber': this.props.trackNumber
        });
    }

    render() {
        return (
            <li onClick={this.handleClick} className={(this.props.active ? 'active ' : '') + 'track'}>
                <span>{this.props.trackInfo.getTrackTitleInfo()} ({this.props.trackInfo.getTotalTimeString()})</span>
            </li>
        )
    }
}
