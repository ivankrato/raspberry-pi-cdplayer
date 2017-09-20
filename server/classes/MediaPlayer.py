import subprocess
import time
from enum import Enum
from pygame import cdrom


class MediaPlayer:
    class DiskType(Enum):
        AUDIO_CD = 'audio_cd'
        MP3_CD = 'mp3_cd'

    def __init__(self):
        cdrom.init()
        self.cd = cdrom.CD(0)
        self.cd.init()
        self._mplayer = None
        self._current_disk_type = None;

    def try_play_cd(self):
        if not self.is_running and self._check_for_cd() == MediaPlayer.DiskType.AUDIO_CD:
            # check for audio CD
            print('playing audio CD')
            self._mplayer = subprocess.Popen(
                ["mplayer", "-slave", "-quiet", "-ao", "alsa:device=hw=1.0", "cdda://:1", "-cache", "1024"],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, bufsize=1)

    def _check_for_cd(self):
        if not self.is_running:
            if not self.cd.get_empty():
                numtracks = self.cd.get_numtracks()
                if numtracks > 0:
                    self._current_disk_type = MediaPlayer.DiskType.AUDIO_CD
            elif True:
                # TODO: get mount point and check for MP3 files
                pass
        return self._current_disk_type

    @property
    def is_running(self):
        return self._mplayer is not None and self._mplayer.poll is None