import React, {Component} from 'react';
import FontAwesome from 'react-fontawesome';

export default class Controls extends Component {
    constructor(props) {
        super(props);
        this.state = {
            enabled: false
        };
        this.props.socket.subscribeToEvent('media_player_info', (data) => {
            if (data.status) {
                let enabled;
                switch (data.status) {
                    case 'playing':
                    case 'paused':
                        enabled = true;
                        break;
                    case 'waitingForCD':
                    default:
                        enabled = false;
                        break;
                }
                this.setState({
                    enabled: enabled,
                })
            }
        });
    }

    render() {
        return (
            <div className={'controls ' + (!this.state.enabled ? 'disabled' : '')}>
                <Control type="prevTrack" icon="fast-backward" enabled={this.state.enabled} socket={this.props.socket} />
                <PlayPause enabled={this.state.enabled} socket={this.props.socket} />
                <Control type="nextTrack" icon="fast-forward" enabled={this.state.enabled} socket={this.props.socket} />
                <Control type="prevBranch" icon="step-backward" enabled={this.state.enabled} socket={this.props.socket} />
                <Control type="eject" icon="eject" enabled={this.state.enabled} socket={this.props.socket} />
                <Control type="nextBranch" icon="step-forward" enabled={this.state.enabled} socket={this.props.socket} />
            </div>
        )
    }
}

class Control extends Component {
    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick() {
        if(this.props.enabled) this.props.socket.emit(this.props.type);
    }

    render() {
        return (
            <span onClick={this.handleClick} className={'control ' + this.props.type}>
                <FontAwesome name={this.props.icon} fixedWidth={true}/>
            </span>
        )
    }
}

class PlayPause extends Component {
    constructor(props) {
        super(props);
        this.state = {
            type: 'play',
            icon: 'play'
        };
        this.props.socket.subscribeToEvent('media_player_info', (data) => {
            if (data.status) {
                let type;
                let icon;
                switch (data.status) {
                    case 'playing':
                        type = 'pause';
                        icon = 'pause';
                        break;
                    default:
                        type = 'play';
                        icon = 'play';
                        break;
                }
                this.setState({
                    type: type,
                    icon: icon
                })
            }
        });
    }

    render() {
        return (
            <Control type={this.state.type} icon={this.state.icon} enabled={this.props.enabled} socket={this.props.socket} />
        )
    }
}

export class VolumeControls extends Component {
    constructor(props) {
        super(props);
        this.state = {
            volume: 20
        };
        this.props.socket.subscribeToEvent('media_player_info', (data) => {
            if (data.volume) {
                this.setState({
                    volume: data.volume,
                })
            }
        });

        this.handleVolumeDownClick = this.handleVolumeDownClick.bind(this);
        this.handleVolumeUpClick = this.handleVolumeUpClick.bind(this);
    }

    handleVolumeDownClick() {
        this.props.socket.emit('volumeDown');
        this.setState({
            volume: this.state.volume - 5 >= 0 ? this.state.volume - 5 : 0,
        })
    }

    handleVolumeUpClick() {
        this.props.socket.emit('volumeUp');
        this.setState({
            volume: (this.state.volume + 5) % 101,
        })
    }

    render() {
        return(
            <div className="volume-controls">
                <FontAwesome name="volume-down" fixedWidth={true} className="down" onClick={this.handleVolumeDownClick}/>
                <span className="volume">{this.state.volume}%</span>
                <FontAwesome name="volume-up" fixedWidth={true} className="up" onClick={this.handleVolumeUpClick}/>
            </div>
        )
    }
}