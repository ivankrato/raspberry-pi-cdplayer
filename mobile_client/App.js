import React from 'react';
import {StyleSheet, Text, View, WebView} from 'react-native';

export default class App extends React.Component {
    render() {
        return (
            <WebView source={{uri: 'http://192.168.0.106:3000'}} style={{marginTop: 30}}/>
        );
    }
}
