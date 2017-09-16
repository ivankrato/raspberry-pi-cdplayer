import React, { Component } from 'react';
import './App.css';
import openSocket from 'socket.io-client';

class SocketController {
    constructor(url) {
        this.socket = openSocket(url);
    }

    subscribeToEvent(eventType, callback) {
        this.socket.on(eventType, data => callback(data));
    }
}

class App extends Component {
  render() {
    return (
      <div className="app">
          <MediaPlayer />
      </div>
    );
  }
}

class MediaPlayer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            data: ''
        };
        this.socketController = new SocketController('http://localhost:5123'); //TODO change URL to window.location.href
        this.socketController.subscribeToEvent('status', (data) => this.setState({
            data: data
        }));
    }

    render() {
        return(
            <div className="media-player">
                <p>This is MediaPlayer.</p>
                <p className="status">{this.state.data}</p>
            </div>
        )
    }
}

export default App;
