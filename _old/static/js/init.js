var socket = io();
var curSongLength = 0;
var timeElapsed = 0;
var isPlaying = false;
var isPaused = false;

socket.on('status', function(message) {
    isPlaying = message.isPlaying;
    isPaused = message.isPaused;
    if(message.numTracks > 0) {
        $('button').removeAttr('disabled');
        var text = 'Playing';
        if (isPaused && isPlaying) {
            text = 'Paused';
        }
        else if(!isPlaying){
            text = 'Waiting for CD';
        }
        $('.status').text(text);
        timeElapsed = Math.floor(message.timeElapsed);
        curSongLength = Math.floor(message.curSongLength);
        if(!message.isPaused) {
            $('.song').text((message.curSong + 1) + '/' + message.numTracks);
            var zero = (timeElapsed%60) < 10 ? '0' : '';
            $('.time').text(Math.floor(timeElapsed/60) + ':' + zero + (timeElapsed%60) + '/' + Math.floor(curSongLength/60) + ':' + (curSongLength%60));
            $('.progress-bar').css('width', (timeElapsed/curSongLength)*100 + "%");
            playTime = message.playTime;
        }
    } else {
        $('.status').text('Waiting for CD');
        $('.song').text('\xa0');
        $('.time').text('\xa0');
        $('.progress-bar').css('width', 0);
        $('button').attr('disabled', 'disabled');
    }
});

$(document).ready(function() {
    for(var i = 0; i < 100; i++) {
        var seekSpan = $('<span class="seek" data-emit="seek" data-seek="' + i + '"></span>');
        $('.progress-bar-wrapper .seeker').append(seekSpan);
        seekSpan.click(function() {
            if(isPlaying && !isPaused) {
                var seekTime = ($(this).data('seek')/100)*curSongLength - timeElapsed;
                socket.emit('seek', seekTime);
            }
        })
    }

    $('button').click(function() {
        var emit = $(this).data('emit');
        socket.emit(emit);
    });
});