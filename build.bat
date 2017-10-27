rmdir /S /Q build
mkdir .\build
xcopy /E .\server\classes .\build\classes\
copy .\server\.lircrc.example .\build\.lircrc.example
copy .\server\main.py .\build\main.py
copy .\server\media_player.conf .\build\media_player.conf
cd .\web_client
call npm install
call npm run build
cd ..
xcopy /E .\web_client\build .\build\web\
mkdir .\build\mobile_client
copy .\mobile_client\android\app\build\outputs\apk\app-release.apk .\build\mobile_client\com.raspberry_pi_cdplayer_mobile_client.apk