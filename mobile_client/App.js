import React, {Component} from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    View,
    Button,
    WebView,
    Modal,
    TextInput,
    AsyncStorage
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
    constructor(props) {
        super(props);
        this.state = {
            ipModalVisible: false,
            ipModalIP: null,
            ipModalPort: null
        };
    }

    openIPModal(id = 0, ip = "", port = "51234") {
        if(id === 0) {
            //TODO read last IP from storage and increment
        }
        this.setState({
            ipModalVisible: true,
            ipModalID: id,
            ipModalIP: ip,
            ipModalPort: port
        });
    }

    closeIPModal(save = false) {
        // TODO add to storage
        this.setState({
            ipModalVisible: false
        });
    }

    loadFromStorage() {
    }

    static navigationOptions = {
        header: null
    };

    render() {
        const {navigate} = this.props.navigation;
        return (
            <View style={styles.container}>
                <Button onPress={() => this.openIPModal()} title="Open modal"/>
                <Modal
                    animationType="slide"
                    transparent={false}
                    visible={this.state.ipModalVisible}
                    onRequestClose={() => {this.closeIPModal()}}
                >
                    <View>
                        <TextInput
                            onChangeText={(ipModalIP) => this.setState({ipModalIP})}
                            value={this.state.ipModalIP}
                        />
                        <TextInput
                            onChangeText={(ipModalPort) => this.setState({ipModalPort})}
                            value={this.state.ipModalPort}
                        />

                        <Button onPress={() => this.closeIPModal(true)} title="Save" />

                    </View>
                </Modal>
            </View>
        );
    }
}

class MediaPlayerScreen extends Component {
    static navigationOptions = {
        header: null
    };

    render() {
        const {params} = this.props.navigation.state;
        return (
            <WebView source={{uri: params.uri}}/>
        )
    }
}

export default App = StackNavigator({
    Home: {
        screen: HomeScreen
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
