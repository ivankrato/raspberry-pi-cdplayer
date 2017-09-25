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
                <Control type="prevBranch" icon="step-backward" enabled={this.state.enabled} socket={this.props.socket} />
                <Control type="prevTrack" icon="fast-backward" enabled={this.state.enabled} socket={this.props.socket} />
                <PlayPause enabled={this.state.enabled} socket={this.props.socket} />
                <Control type="nextTrack" icon="fast-forward" enabled={this.state.enabled} socket={this.props.socket} />
                <Control type="nextBranch" icon="step-forward" enabled={this.state.enabled} socket={this.props.socket} />
                <Control type="eject" icon="eject" enabled={this.state.enabled} socket={this.props.socket} />
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