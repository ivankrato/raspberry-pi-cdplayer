import queue
from threading import Thread, Lock
import subprocess
from time import sleep
from enum import Enum
from classes.MediaLibrary import MediaLibrary
from classes.MediaPlayerInfo import MediaPlayerInfo, CurrentTrackInfo, TrackInfo
import json


class MediaPlayer:
    class DiskType(Enum):
        AUDIO_CD = 'audio_cd'
        MP3_CD = 'mp3_cd'

    def __init__(self):
        self._cd = CD()
        self._mpv = None
        self._current_disk_type = None
        self._media_library = None
        self._current_track_list = None
        self._mpv_lock = Lock()
        self._info_events = None
        self._info_event_thread = None
        self._current_track = 0

    def _info_event_loop(self):
        while self.is_running:
            # self._mpv_lock.acquire()
            self._info_events.put(self.get_current_info())
            # self._mpv_lock.release()
            sleep(10)

    def get_current_info(self, status=True, cur_track_info=True, track_list=False, library=False):
        info = MediaPlayerInfo()
        if self.is_running:
            if status:
                # TODO change commands
                status_res = self._run_command('get_property pause')
                info.status = 'paused' if status_res else 'playing'
            if cur_track_info:
                info.cur_track_info = CurrentTrackInfo()
                # TODO check MP3 (probably need different commands)
                if self._current_disk_type == MediaPlayer.DiskType.AUDIO_CD:
                    chapter_res = self._run_command('get_property chapter')
                    self._current_track = chapter_res
                    info.cur_track_info.track_number = chapter_res
                if self._current_track is not None:
                    time_res = self._run_command('get_property time-pos')
                    time_millis = time_res*1000
                    for track in self._current_track_list[0:self._current_track]:
                        time_millis -= track.total_time
                    info.cur_track_info.cur_time = time_millis
            if track_list and self._current_track_list is not None:
                info.track_list = list(map(lambda x: x.as_dict(), self._current_track_list))
            if library and self._media_library is not None:
                info.library = self._media_library.as_dict()
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
        if not self.is_running and self._check_for_cd() == MediaPlayer.DiskType.AUDIO_CD:
            # check for audio CD
            print('playing audio CD')
            self._mpv = subprocess.Popen(
                ["mpv", "--quiet", "--audio-device=alsa/plughw:Device,DEV=0", "cdda://", "--cache=1024",
                 "--input-ipc-server=/tmp/mpvsocket"], bufsize=1)

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

    def _run_command(self, command):
        command_json = {
            "command": command.split()
        }
        command_json_str = json.dumps(command_json) + '\n'
        socat = subprocess.Popen(['socat', '-', '/tmp/mpvsocket'], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        socat_output = socat.communicate(command_json_str.encode('utf-8'))
        if socat_output[0] is not None and len(socat_output[0]) != 0 and socat_output[1] is None:
            data = json.loads(socat_output[0].decode())
            return data['data']

    def next_track(self):
        self._run_command('add chapter 1')
        self._info_events.put(self.get_current_info())

    def prev_track(self):
        self._run_command('add chapter -1')
        self._info_events.put(self.get_current_info())

    def pause(self):
        self._run_command('set pause yes')
        self._info_events.put(self.get_current_info(cur_track_info=False))

    def play(self):
        self._run_command('set pause no')
        self._info_events.put(self.get_current_info(cur_track_info=False))

    @property
    def is_running(self):
        return self._mpv is not None and self._mpv.poll() is None


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
