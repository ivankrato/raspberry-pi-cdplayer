import React, {Component} from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    View,
    Button,
    WebView
} from 'react-native';
import {
    StackNavigator,
} from 'react-navigation';

import MusicControl from 'react-native-music-control';

MusicControl.enableControl('play', true);
MusicControl.enableControl('pause', true);
MusicControl.enableControl('stop', true);
MusicControl.enableControl('nextTrack', true);
MusicControl.enableControl('previousTrack', true);

class HomeScreen extends Component {
    static navigationOptions = {
        header: null
    };

    render() {
        const {navigate} = this.props.navigation;
        return (
            <View style={styles.container}>
                <Button onPress={() => navigate('MediaPlayer', {uri: 'http://raspberrypi.local:51234'})} title="Try Music Control"/>
            </View>
        );
    }
}

class MediaPlayerScreen extends Component {
    static navigationOptions = {
        header: null
    };

    render() {
        const { params } = this.props.navigation.state;
        return (
            <WebView source={{uri: params.uri}}/>
        )
    }
}

class AddIPScreen extends Component {
    render() {
        return (
            <Text>Test</Text>
        )
    }
}

export default App = StackNavigator({
    Home: {
        screen: HomeScreen
    },
    AddIP: {
        screen: AddIPScreen
    },
    MediaPlayer: {
        screen: MediaPlayerScreen
    }
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5FCFF',
    }
});
