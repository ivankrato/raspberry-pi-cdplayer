import queue
from threading import Thread, Lock
import subprocess
import pty
import os
import select
from time import sleep
from enum import Enum
from classes.MediaLibrary import MediaLibrary
from classes.MediaPlayerInfo import MediaPlayerInfo, CurrentTrackInfo, TrackInfo


class MediaPlayer:
    class DiskType(Enum):
        AUDIO_CD = 'audio_cd'
        MP3_CD = 'mp3_cd'

    def __init__(self):
        self._cd = CD()
        self._mplayer = None
        self._mplayer_stdout = None
        self._current_disk_type = None
        self._media_library = None
        self._current_track_list = None
        self._mplayer_lock = Lock()
        self._info_events = None
        self._info_event_thread = None

    def _info_event_loop(self):
        while self.is_running:
            # self._mplayer_lock.acquire()
            # self._info_events.put(self.get_current_info())
            # self._mplayer_lock.release()
            sleep(10)

    def get_current_info(self, status=True, cur_track_info=True, track_list=False, library=False):
        info = MediaPlayerInfo()
        stdin = self._mplayer.stdin
        stdout = self._mplayer_stdout
        if self.is_running:
            if status:
                stdin.write(b'pausing_keep_force get_property pause\n')
            if cur_track_info:
                # TODO check MP3 (probably need different commands)
                info.cur_track_info = CurrentTrackInfo()
                if self._current_disk_type == MediaPlayer.DiskType.AUDIO_CD:
                    stdin.write(b'get_property chapter\n')
                stdin.write(b'get_property time_pos\n')
            if track_list and self._current_track_list is not None:
                info.track_list = list(map(lambda x: x.as_dict(), self._current_track_list))
            if library and self._media_library is not None:
                info.library = self._media_library.as_dict()
            stdin.flush()
            sleep(0.05)
            # give mplayer a little bit of time to create output
            while select.select([stdout], [], [], 0.05)[0]:
                line = stdout.readline()
                print(line, end='')

                def get_value(ans):
                    output_split = line.split(ans + '=')
                    if len(output_split) == 2 and output_split[0] == '':
                        return output_split[1].rstrip()

                pause = get_value('ANS_pause')
                if pause == 'yes':
                    info.status = 'paused'
                elif pause == 'no':
                    info.status = 'playing'

                chapter = get_value('ANS_chapter')
                if chapter is not None:
                    info.cur_track_info.track_number = int(chapter)

                time_pos = get_value('ANS_time_pos')
                if time_pos is not None and info.cur_track_info.track_number is not None:
                    time_millis = float(time_pos) * 1000
                    for track_info in self._current_track_list[0:info.cur_track_info.track_number]:
                        time_millis -= track_info.total_time
                    info.cur_track_info.cur_time = time_millis
        else:
            info.status = 'waitingForCD'
        return info

    def poll_info(self):
        try:
            info_event = self._info_events.get_nowait()
            return info_event
        except queue.Empty:
            return None

    def try_play_cd(self):
        self._info_events = queue.Queue()
        master, slave = pty.openpty()
        if not self.is_running and self._check_for_cd() == MediaPlayer.DiskType.AUDIO_CD:
            # check for audio CD
            print('playing audio CD')
            self._mplayer = subprocess.Popen(
                ["mplayer", "-slave", "-quiet", "-ao", "alsa:device=hw=1.0", "cdda://:1", "-cache", "1024"],
                stdin=subprocess.PIPE, stdout=slave, bufsize=1)

        self._mplayer_stdout = os.fdopen(master)
        self._info_event_thread = Thread(target=self._info_event_loop, args=[])
        self._info_event_thread.setDaemon(True)
        self._info_event_thread.start()
        # TODO send new track list

    def _check_for_cd(self):
        if not self.is_running:
            self._cd.load_cd_info()
            if CD.is_cd_inserted():
                numtracks = self._cd.numtracks
                if numtracks > 1:
                    # CD that isn't audio CD has 1 track
                    self._current_disk_type = MediaPlayer.DiskType.AUDIO_CD
                    self._current_track_list = list(map(lambda x: TrackInfo(x), self._cd.track_lengths))
                else:
                    df = subprocess.getoutput('df | grep sr0').split()
                    mount_point = ' '.join(df[5:])
                    self._media_library = MediaLibrary()
                    self._media_library.init(mount_point)
                    if self._media_library.media_file_count > 0:
                        self._current_disk_type = MediaPlayer.DiskType.MP3_CD
                    else:
                        return None
        return self._current_disk_type

    def next_track(self):
        self._mplayer.stdin.write(b'seek_chapter 1\n')
        self._info_events.put(self.get_current_info())

    def prev_track(self):
        self._mplayer.stdin.write(b'seek_chapter -1\n')
        self._info_events.put(self.get_current_info())

    def play_pause(self):
        self._mplayer.stdin.write(b'pause\n')
        self._info_events.put(self.get_current_info())


    @property
    def is_running(self):
        return self._mplayer is not None and self._mplayer.poll() is None


class CD:
    def __init__(self):
        self._numtracks = 0
        self._track_lengths = []

    def load_cd_info(self):
        discid = subprocess.getstatusoutput('cd-discid --musicbrainz')
        if discid[0] == 0:
            output_split = discid[1].split()
            self._numtracks = int(output_split[0])
            track_offsets = list(map(lambda i: int(i), output_split[1:]))
            self._track_lengths = list(
                map(lambda i, offsets=track_offsets: int((offsets[i + 1] - offsets[i]) * 1000 / 75),
                    range(0, self._numtracks)))
        else:
            self._numtracks = 0
            self._track_lengths = []

    @staticmethod
    def is_cd_inserted():
        try:
            subprocess.check_output(['cd-discid', '--musicbrainz'])
        except subprocess.CalledProcessError:
            # return value is not 0
            return False
        return True

    @property
    def numtracks(self):
        return self._numtracks

    @property
    def track_lengths(self):
        return self._track_lengths
