import queue
import subprocess
from time import sleep
from enum import Enum
from classes.MediaLibrary import MediaLibrary
from classes.MediaPlayerInfo import MediaPlayerInfo, CurrentTrackInfo, TrackInfo
import json


# TODO: change playlist, set data on reconnect, library CSS

class MediaPlayer:
    class DiskType(Enum):
        AUDIO_CD = 'audio_cd'
        MP3_CD = 'mp3_cd'

    MPV_COMMAND = ["mpv", "--quiet", "--audio-device=alsa/plughw:Device,DEV=0",
                   "--cache=1024", "--loop",
                   "--input-ipc-server=/tmp/mpvsocket"]

    def __init__(self):
        self._cd = CD()
        self._mpv = None
        self._current_disk_type = None
        self._media_library = None
        self._current_track_list = None
        self._current_media_library_branch_type_index = None
        self._info_events = None
        self._current_track = 0

    def get_current_info(self, status=True, cur_track_info=True, track_list=False, library=False):
        info = MediaPlayerInfo()
        if self.is_running:
            if status:
                status_res = self._run_command('get_property', 'pause')
                info.status = 'paused' if status_res else 'playing'
            if cur_track_info:
                info.cur_track_info = CurrentTrackInfo()
                if self._current_disk_type == MediaPlayer.DiskType.AUDIO_CD:
                    chapter_res = self._run_command('get_property', 'chapter')
                    self._current_track = chapter_res
                    info.cur_track_info.track_number = chapter_res
                elif self._current_disk_type == MediaPlayer.DiskType.MP3_CD:
                    playlist_pos_res = self._run_command('get_property', 'playlist-pos')
                    self._current_track = playlist_pos_res
                    info.cur_track_info.track_number = playlist_pos_res
                if self._current_track is not None:
                    time_res = self._run_command('get_property', 'time-pos')
                    if time_res is not None:
                        time_millis = time_res * 1000
                        if self._current_disk_type == MediaPlayer.DiskType.AUDIO_CD:
                            for track in self._current_track_list[0:self._current_track]:
                                time_millis -= track.total_time
                        info.cur_track_info.cur_time = time_millis
            if track_list and self._current_track_list is not None:
                info.track_list = list(map(lambda x: x.as_dict(), self._current_track_list))
            if library and self._media_library is not None:
                info.library = self._media_library
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
        if not self.is_running:
            cd_type = self._check_for_cd()
            if cd_type == MediaPlayer.DiskType.AUDIO_CD:
                # check for audio CD
                print('playing audio CD')
                self._mpv = subprocess.Popen(MediaPlayer.MPV_COMMAND + [
                    'cdda://'
                ], bufsize=1)
            elif cd_type == MediaPlayer.DiskType.MP3_CD:
                # check for MP3 CD
                print('playing MP3 CD')
                self._mpv = subprocess.Popen(MediaPlayer.MPV_COMMAND +
                                             [self._media_library.media_folders[0].path],
                                             bufsize=1)
                self._current_media_library_branch_type_index = (MediaLibrary.BranchType.FOLDERS, 0)
            sleep(1)
            self._info_events.put(self.get_current_info(True, True, True, True))

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
                        self._current_track_list = list(map(
                            lambda media_info: TrackInfo(media_info.total_time, media_info.artist, media_info.album,
                                                         media_info.title),
                            self._media_library.media_folders[0].media_files))
                        print(self._media_library.as_dict())
                    else:
                        return None
        return self._current_disk_type

    def _run_command(self, *command):
        command_dict = {
            "command": command
        }
        command_json = json.dumps(command_dict) + '\n'
        socat = subprocess.Popen(['socat', '-', '/tmp/mpvsocket'], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        socat_output = socat.communicate(command_json.encode('utf-8'))
        if socat_output[0] is not None and \
                        len(socat_output[0]) != 0 and \
                        socat_output[1] is None:
            try:
                data = json.loads(socat_output[0].decode())
                return data['data']
            except:
                return None

    def _put_info_with_delay(self, full=False):
        if full:
            sleep(0.2)
            self._info_events.put(self.get_current_info(True, True, True, True))
            sleep(1)
            self._info_events.put(self.get_current_info(True, True, True, True))
        else:
            sleep(0.2)
            self._info_events.put(self.get_current_info())
            sleep(1)
            self._info_events.put(self.get_current_info())

    def next_track(self):
        last_track = len(self._current_track_list) - 1
        if self._current_track != last_track:
            if self._current_disk_type == MediaPlayer.DiskType.AUDIO_CD:
                self._run_command('add', 'chapter', '1')
            elif self._current_disk_type == MediaPlayer.DiskType.MP3_CD:
                self._run_command('add', 'playlist-pos', '1')
        else:
            if self._current_disk_type == MediaPlayer.DiskType.AUDIO_CD:
                self._run_command('set', 'chapter', '0')
            elif self._current_disk_type == MediaPlayer.DiskType.MP3_CD:
                self._run_command('set', 'playlist-pos', '0')
        self._put_info_with_delay()

    def prev_track(self):
        if self._current_track != 0:
            if self._current_disk_type == MediaPlayer.DiskType.AUDIO_CD:
                self._run_command('add', 'chapter', '-1')
            elif self._current_disk_type == MediaPlayer.DiskType.MP3_CD:
                self._run_command('add', 'playlist-pos', '-1')
        else:
            last_track = len(self._current_track_list) - 1
            if self._current_disk_type == MediaPlayer.DiskType.AUDIO_CD:
                self._run_command('set', 'chapter', str(last_track))
            elif self._current_disk_type == MediaPlayer.DiskType.MP3_CD:
                self._run_command('set', 'playlist-pos', str(last_track))
        self._put_info_with_delay()

    def next_branch(self):
        if self._current_media_library_branch_type_index[0] == MediaLibrary.BranchType.FOLDERS:
            folder_index = self._current_media_library_branch_type_index[1]
            folder_index = (folder_index + 1) % len(self._media_library.media_folders)
            self.play_file(MediaLibrary.BranchType.FOLDERS, (folder_index, None, None, 0))

    def play_track(self, track_number):
        if self._current_disk_type == MediaPlayer.DiskType.AUDIO_CD:
            self._run_command('set', 'chapter', str(track_number))
        elif self._current_disk_type == MediaPlayer.DiskType.MP3_CD:
            self._run_command('set', 'playlist-pos', str(track_number))
        self._put_info_with_delay()

    def play_file(self, media_library_type, indexes):
        if self._current_disk_type == MediaPlayer.DiskType.MP3_CD and \
                        media_library_type is not None and \
                        indexes is not None:
            files = None
            file_index = 0
            if media_library_type == 'folders':
                self._current_media_library_branch_type_index = (MediaLibrary.BranchType.FOLDERS,
                                                                 indexes[0])
                files = self._media_library.media_folders[indexes[0]].media_files
            elif media_library_type == 'artists':
                self._current_media_library_branch_type_index = (MediaLibrary.BranchType.ARTISTS,
                                                                 indexes[1],
                                                                 indexes[2])
                files = self._media_library.artists[indexes[1]].albums[indexes[2]].songs
            file_index = indexes[3]
            if files is not None:
                ordered_files = files[file_index:] + files[0:file_index]
                self._current_track_list = list(map(
                    lambda media_info: TrackInfo(media_info.total_time, media_info.artist, media_info.album,
                                                 media_info.title),
                    ordered_files))
                self._run_command('playlist-clear')
                self._run_command('loadfile', files[file_index].full_path)
                for file in ordered_files[1:]:
                    self._run_command('loadfile', file.full_path, 'append')
        self._put_info_with_delay(True)

    def play_pause(self):
        pause = self._run_command('get_property', 'pause')
        if pause:
            self._run_command('set', 'pause', 'no')
        else:
            self._run_command('set', 'pause', 'yes')
        self._info_events.put(self.get_current_info())

    def stop(self):
        try:
            self._mpv.kill()
        except:
            print("Nothing is playing.")
        subprocess.Popen(['eject', 'cdrom'])
        self.eject()
        self._current_disk_type = None
        self._current_track = 0
        self._current_track_list = None
        self._current_media_library_branch_type_index = None
        self._media_library = None
        self._info_events.put(self.get_current_info(True, True, True, True))

    def eject(self):
        subprocess.Popen(['eject', 'cdrom'])

    def seek(self, seek_percent):
        time_millis = self._current_track_list[self._current_track].total_time * seek_percent / 100
        if self._current_disk_type == MediaPlayer.DiskType.AUDIO_CD:
            for track in self._current_track_list[:self._current_track]:
                time_millis += track.total_time
        self._run_command('set', 'time-pos', str(time_millis / 1000))
        # (time_millis / 1000) * (seek_percent / 100)
        self._put_info_with_delay()

    @property
    def is_running(self):
        return self._mpv is not None and self._mpv.poll() is None

    @property
    def current_track_list(self):
        return self._current_track_list


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
