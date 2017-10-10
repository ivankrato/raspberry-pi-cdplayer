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
        this.loadIPList();
        this.state = {
            ipModalVisible: false,
            ipModalIP: null,
            ipModalPort: null,
            editIndex: null,
            ipList: []
        };
    }

    loadIPList() {
        AsyncStorage.getItem('@IPList:list').then((ipList) => {
            if (ipList === null) {
                AsyncStorage.setItem('@IPList:list', JSON.stringify([]));
                ipList = [];
            } else {
                ipList = JSON.parse(ipList);
            }
            this.setState({
                ipList: ipList
            })
        });
    }

    saveIPList(ipList) {
        try {
            AsyncStorage.setItem('@IPList:list', JSON.stringify(ipList));
            this.setState({
                ipList: ipList
            })
        }
        catch (error) {
            alert(error);
        }
    }

    deleteFromIPList(index) {
        let ipList = this.state.ipList;
        ipList.splice(index, 1);
        this.saveIPList(ipList);
    }

    openIPModal(editIndex = null) {
        this.setState({
            ipModalVisible: true,
            ipModalIP: editIndex !== null ? this.state.ipList[editIndex].ip : "",
            ipModalPort: editIndex !== null ? this.state.ipList[editIndex].port : "51234",
            editIndex: editIndex
        });
    }

    closeIPModal(save = false) {
        if (save) {
            let ipList = this.state.ipList;
            if (this.state.editIndex === null) {
                ipList.push({
                    ip: this.state.ipModalIP,
                    port: this.state.ipModalPort
                });
            } else {
                ipList[this.state.editIndex] = {
                    ip: this.state.ipModalIP,
                    port: this.state.ipModalPort
                };
            }
            this.saveIPList(ipList);
        }
        this.setState({
            ipModalVisible: false,
            editIndex: null
        });
    }

    openMediaPlayer(index) {
        ip = this.state.ipList[index];
        const uri = 'http://' + ip.ip + ((ip.port !== '') ? (':' + ip.port) : '');

        function showError() {
            alert('Cannot connect to ' + uri);
        }

        const { navigate } = this.props.navigation;

        fetch(uri + '/getMediaPlayerInfo').then((response) => {
            if(response.ok) {
                navigate('MediaPlayer', {
                    uri: uri
                })
            } else {
                showError()
            }
        }).catch((error) => showError());
    }

    static navigationOptions = {
        header: null
    };

    render() {
        const {navigate} = this.props.navigation;
        return (
            <View style={styles.container}>
                {this.state.ipList.map((ip, index) => {
                        return (
                            <View key={index}>
                                <Button title={ip.ip + ':' + ip.port} onPress={() => {this.openMediaPlayer(index)}}/>
                                <Button title="Edit" onPress={() => {this.openIPModal(index)}}/>
                                <Button title="Delete" onPress={() => {this.deleteFromIPList(index)}}/>
                            </View>
                        )
                    }
                )}
                <Button onPress={() => this.openIPModal()} title="Add Media Player"/>


                <Modal
                    animationType="slide"
                    transparent={false}
                    visible={this.state.ipModalVisible}
                    onRequestClose={() => {
                        this.closeIPModal()
                    }}
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

                        <Button onPress={() => this.closeIPModal(true)} title="Save"/>
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

    handleOnMessage(event) {
        data = JSON.parse(event.nativeEvent.data);
        if(data.status) {
            switch(data.status) {
                case 'waitingForCD':
                    MusicControl.resetNowPlaying();
                    break;
                case 'pause':
                    MusicControl.updatePlayback({
                        state: MusicControl.STATE_PAUSED
                    });
                    break;
                case 'playing':
                    MusicControl.updatePlayback({
                        state: MusicControl.STATE_PLAYING
                    });
            }
        }
        if(data.trackInfo) {
            MusicControl.setNowPlaying({
                title: data.trackInfo.title,
                artist: data.trackInfo.artist,
                album: data.trackInfo.album,
            })
        }
    }

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
