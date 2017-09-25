import React, {Component} from 'react';
import './App.css';
import MediaPlayer from './MediaPlayer';

class App extends Component {
    render() {
        return (
            <div className="app">
                <MediaPlayer/>
            </div>
        );
    }
}

export default App;
