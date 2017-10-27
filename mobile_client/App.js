import React, {Component} from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    Button,
    TouchableOpacity,
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
            curIndex: null,
            ipList: [],
            lastIndex: 0
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
        AsyncStorage.getItem('@IPList:lastIndex').then((lastIndex) => {
            if (lastIndex !== null) {
                this.setState({
                    lastIndex: Number(lastIndex)
                })
            }
        })
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
        this.closeIPModal();
    }

    openIPModal(editIndex = null) {
        this.setState({
            ipModalVisible: true,
            ipModalIP: editIndex !== null ? this.state.ipList[editIndex].ip : "",
            ipModalPort: editIndex !== null ? this.state.ipList[editIndex].port : "51234",
            curIndex: editIndex
        });
    }

    closeIPModal(save = false) {
        if (save) {
            let ipList = this.state.ipList;
            if (this.state.curIndex === null) {
                ipList.push({
                    ip: this.state.ipModalIP,
                    port: this.state.ipModalPort
                });
            } else {
                ipList[this.state.curIndex] = {
                    ip: this.state.ipModalIP,
                    port: this.state.ipModalPort
                };
            }
            this.saveIPList(ipList);
        }
        this.setState({
            ipModalVisible: false,
            curIndex: null
        });
    }

    openMediaPlayer(index) {
        ip = this.state.ipList[index];
        const uri = 'http://' + ip.ip + ((ip.port !== '') ? (':' + ip.port) : '');

        function showError() {
            alert('Cannot connect to ' + uri);
        }

        const {navigate} = this.props.navigation;
        fetch(uri + '/getMediaPlayerInfo').then((response) => {
            if (response.ok) {
                // save last index
                try {
                    AsyncStorage.setItem('@IPList:lastIndex', index.toString());
                    this.setState({
                        lastIndex: index
                    })
                }
                catch (error) {
                    alert(error);
                }
                this.closeIPModal();
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
        const lastIp = this.state.ipList[this.state.lastIndex] || {ip: 'unknown', port: 'unknown'};
        return (
            <View style={styles.container}>
                <ScrollView style={styles.scrollContainer}>
                    {this.state.ipList.map((ip, index) => {
                            return (
                                <View key={index} style={[styles.p5]}>
                                    <Button style={{flex: 3}} title={ip.ip + ':' + ip.port} onPress={() => {
                                        this.openIPModal(index)
                                    }}/>
                                </View>
                            )
                        }
                    )}
                </ScrollView>
                <View style={styles.p5}>
                    <TouchableOpacity style={styles.connectButton} onPress={() => {
                        if(this.state.ipList[this.state.lastIndex]) {
                            this.openMediaPlayer(this.state.lastIndex)
                        }
                    }}>
                        <Text style={styles.connectButtonText}>{lastIp.ip}:{lastIp.port}</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.p5}>
                    <Button color="green" style={styles.p5} onPress={() => this.openIPModal()} title="Add Media Player"/>
                </View>

                <Modal
                    animationType="slide"
                    transparent={false}
                    visible={this.state.ipModalVisible}
                    onRequestClose={() => {
                        this.closeIPModal()
                    }}
                >
                    <View style={[styles.p5, styles.modal]}>
                        <TextInput
                            onChangeText={(ipModalIP) => this.setState({ipModalIP})}
                            value={this.state.ipModalIP}
                            placeholder="IP or hostname"
                        />
                        <TextInput
                            onChangeText={(ipModalPort) => this.setState({ipModalPort})}
                            value={this.state.ipModalPort}
                            placeholder="Port"
                        />
                        <View style={styles.modalButtonContainer}>
                            <View style={styles.p5}>
                                <Button onPress={() => this.closeIPModal(true)} title="Save"/>
                            </View>
                            {
                                (() => {
                                    if (this.state.curIndex !== null) {
                                        return (
                                            <View>
                                                <View style={styles.p5}>
                                                    <Button color="red" title="Delete" onPress={() => {
                                                        this.deleteFromIPList(this.state.curIndex)
                                                    }}/>
                                                </View>
                                                <View style={styles.p5}>
                                                    <TouchableOpacity style={styles.connectButton} onPress={() => {
                                                        this.openMediaPlayer(this.state.curIndex)
                                                    }}>
                                                        <Text style={styles.connectButtonText}>CONNECT</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )
                                    }
                                })()
                            }
                        </View>
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
        if (data.status) {
            switch (data.status) {
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
        if (data.trackInfo) {
            MusicControl.setNowPlaying({
                title: data.trackInfo.title,
                artist: data.trackInfo.artist,
                album: data.trackInfo.album,
            })
        }
    }

    componentDidMount() {
        for(let event of ['play', 'pause', 'nextTrack']) {
            MusicControl.on(event, ()=> {
                this.refs.webView.postMessage(event);
            });
        }
        MusicControl.on('previousTrack', ()=> {
            this.refs.webView.postMessage('prevTrack');
        });
        MusicControl.on('stop', ()=> {
            this.refs.webView.postMessage('eject');
        });
    }

    render() {
        const {params} = this.props.navigation.state;
        return (
            <WebView ref="webView" source={{uri: params.uri}} onMessage={this.handleOnMessage}/>
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
        paddingTop: 20,
        flex: 1
    },
    scrollContainer: {
        flexDirection: 'column',
    },
    p5: {
        padding: 5
    },
    modal: {
        paddingVertical: 20
    },
    connectButton: {
        backgroundColor: 'green',
        height: 100,
        justifyContent: 'center',
        borderRadius: 4,
    },
    connectButtonText: {
        fontWeight: 'bold',
        color: 'white',
        textAlign: 'center',
        fontSize: 24,
    }
});