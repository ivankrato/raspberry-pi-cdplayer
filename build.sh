#!/bin/bash

rm -rf ./build
mkdir build
cp -R ./server/classes ./build/classes
cp ./server/.lircrc.example ./build/.lircrc.example
cp ./server/main.py ./build/main.py
cp ./server/media_player.conf ./build/media_player.conf
cd ./web_client
npm install
npm run build
cd ..
cp -R ./web_client/build ./build/web