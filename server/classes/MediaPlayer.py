import subprocess
import time
from enum import Enum
from pygame import cdrom
from classes.MediaLibrary import MediaLibrary


class MediaPlayer:
    class DiskType(Enum):
        AUDIO_CD = 'audio_cd'
        MP3_CD = 'mp3_cd'

    def __init__(self):
        cdrom.init()
        self.cd = cdrom.CD(0)
        self.cd.init()
        self._mplayer = None
        self._current_disk_type = None
        self._media_library = None
        self._current_track_list = None

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
                df = subprocess.getoutput('df | grep sr0').split()
                mount_point = ' '.join(df[5:])
                self._media_library = MediaLibrary()
                self._media_library.init(mount_point)
                print(mount_point)
                numtracks = self.cd.get_numtracks()
                if self._media_library.media_file_count > 0:
                    self._current_disk_type = MediaPlayer.DiskType.MP3_CD
                elif numtracks > 0:
                    self._current_disk_type = MediaPlayer.DiskType.AUDIO_CD
        return self._current_disk_type

    @property
    def is_running(self):
        return self._mplayer is not None and self._mplayer.poll is None