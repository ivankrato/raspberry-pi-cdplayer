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
            if (data.track_list) {
                this.setState({
                    trackList: data.track_list.map((track) => {
                        return new TrackInfo(track);
                    })
                });
            }
            if (data.cur_track_info) {
                this.setState({
                    curTrackNumber: data.cur_track_info.track_number || this.state.curTrackNumber
                })
            }
        });
    }

    componentDidUpdate() {
        function height() {
            let trackList = this.refs.trackList;
            trackList.style.height = window.innerHeight - trackList.offsetTop + 'px';
        }
        height.bind(this)();
        window.addEventListener('resize', height.bind(this));
    }

    render() {
        return (
            <div className="track-list" ref="trackList">
                <ol>
                    {this.state.trackList.map((trackInfo, trackNumber) => {
                        return (
                            <Track key={trackNumber} trackInfo={trackInfo} trackNumber={trackNumber} socket={this.props.socket} active={trackNumber === this.state.curTrackNumber}/>
                        )
                    })}
                </ol>
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
                {this.props.trackInfo.getTrackTitleInfo()} ({this.props.trackInfo.getTotalTimeString()})
            </li>
        )
    }
}
