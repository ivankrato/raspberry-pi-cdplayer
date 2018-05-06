import queue
import subprocess
from time import sleep
from enum import Enum
from classes.MediaLibrary import MediaLibrary
from classes.MediaPlayerInfo import MediaPlayerInfo, CurrentTrackInfo, TrackInfo
import json
import musicbrainzngs as m
import libdiscid

class MediaPlayer:
    """
    Contains logic for controlling mpv and getting information about CD.
    """

    class DiskType(Enum):
        AUDIO_CD = 'audio_cd'
        MP3_CD = 'mp3_cd'

    class BranchType(Enum):
        FOLDERS = 'folders'
        ARTISTS = 'artists'
        ALBUMS = 'albums'

    def __init__(self, config):
        self._config = config
        self.MPV_COMMAND = ["mpv", "--quiet", "--vo=null",
                            "--no-audio-display",
                            "--cache=1024", "--loop",
                            "--input-ipc-server=" + self._config['MPV_SOCKET_PATH']]
        self._cd = CD()
        self._mpv = None
        self._current_disk_type = None
        self._media_library = None
        self._current_track_list = None
        self._current_media_library_branch_type_index = None
        self._info_events = None
        self._current_track = 0
        self._volume = 95

    def get_current_info(self, status=True, cur_track_info=True, volume=True, track_list=False, library=False):
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
            if volume:
                vol = self._run_command('get_property', 'volume')
                if vol is not None:
                    self._volume = vol
                    info.volume = vol
            if track_list and self._current_track_list is not None:
                info.track_list = list(map(lambda x: x.as_dict(), self._current_track_list))
            if library and self._media_library is not None:
                info.library = self._media_library
        else:
            info.volume = self._volume
            info.status = 'waitingForCD'

        return info

    def poll_info(self):
        try:
            info_event = self._info_events.get_nowait()
            return info_event
        except queue.Empty:
            return None

    def try_play_cd(self):
        """
        Tries to play CD in CD drive, if there is any (or USB drive).
        Sets the current media library branch type and index attribute and puts info into the info queue.
        :return: None
        """
        self._info_events = queue.Queue()
        if not self.is_running:
            cd_type = self._check_for_cd()
            if cd_type is None:
                return
            if cd_type == MediaPlayer.DiskType.AUDIO_CD:
                # check for audio CD
                print('playing audio CD')
                self._mpv = subprocess.Popen(self.MPV_COMMAND + [
                    'cdda://', '--volume=' + self._config['DEFAULT_VOLUME']
                ], bufsize=1)
            elif cd_type == MediaPlayer.DiskType.MP3_CD:
                # check for MP3 CD
                print('playing MP3 CD')
                self._mpv = subprocess.Popen(self.MPV_COMMAND + ['--volume=' + self._config['DEFAULT_VOLUME']] +
                                             list(map(lambda file: file.full_path,
                                                      self._media_library.media_folders[0].media_files)),
                                             bufsize=1)
                self._current_media_library_branch_type_index = (MediaPlayer.BranchType.FOLDERS, 0)
            info = self.get_current_info(True, True, True, True, True)
            # info = self.get_current_info(True, False, True, True, True)
            # fill cur_track_info with zeros, because it may not be initialized yet (mpv loading)
            info.cur_track_info = CurrentTrackInfo()
            info.cur_track_info.cur_time = 0
            info.cur_track_info.track_number = 0
            self._info_events.put(info)

    def _check_for_cd(self):
        self._current_disk_type = None
        self._current_track_list = []
        self._cd.load_cd_info()
        df = []
        if CD.is_cd_inserted():
            if self._cd.numtracks > 1:
                # CD that isn't audio CD has 1 track
                self._current_disk_type = MediaPlayer.DiskType.AUDIO_CD
                try:
                    artist = self._cd._cd_info['disc']['release-list'][0]['artist-credit-phrase']
                    album = self._cd._cd_info['disc']['release-list'][0]['title']
                    self._current_track_list = list(map(
                        lambda x, y: TrackInfo(y, artist, album, x['recording']['title']),
                        self._cd._cd_info['disc']['release-list'][0]['medium-list'][0]['track-list'],
                        self._cd.track_lengths))
                except:
                    self._current_track_list = list(map(lambda x: TrackInfo(x), self._cd.track_lengths))
            else:
                df = subprocess.getoutput('df | grep ' + self._config['CD_DEVICE']).split()
        else:
            df = subprocess.getoutput('df | grep ' + self._config['USB_DEVICE']).split()
        if len(df) > 0:
            mount_point = ' '.join(df[5:])
            self._media_library = MediaLibrary()
            self._media_library.init(mount_point)
            if self._media_library.media_file_count > 0:
                self._current_disk_type = MediaPlayer.DiskType.MP3_CD
                self._current_track_list = list(map(
                    lambda media_info: TrackInfo(media_info.total_time, media_info.artist, media_info.album,
                                                 media_info.title),
                    self._media_library.media_folders[0].media_files))
                # print(self._media_library.as_dict())
        return self._current_disk_type

    def _run_command(self, *command):
        command_dict = {
            "command": command
        }
        command_json = json.dumps(command_dict) + '\n'
        socat = subprocess.Popen(['socat', '-', self._config['MPV_SOCKET_PATH']], stdin=subprocess.PIPE,
                                 stdout=subprocess.PIPE)
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
            self._info_events.put(self.get_current_info(True, True, True, True, True))
            sleep(1)
            self._info_events.put(self.get_current_info(True, True, True, True, True))
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
        if self._current_disk_type == MediaPlayer.DiskType.AUDIO_CD:
            self.next_track()
        elif self._current_disk_type == MediaPlayer.DiskType.MP3_CD:
            type_index = self._current_media_library_branch_type_index
            folder_index = None
            artist_index = None
            album_index = None
            if type_index[0] == MediaPlayer.BranchType.FOLDERS:
                folder_index = (type_index[1] + 1) % len(self._media_library.media_folders)
            elif type_index[0] == MediaPlayer.BranchType.ALBUMS:
                artist_index = (type_index[1] + 1) % len(self._media_library.artists)
                album_index = type_index[2] + 1
                if album_index >= len(self._media_library.artists[artist_index].albums):
                    album_index = 0
            elif type_index[0] == MediaPlayer.BranchType.ARTISTS:
                artist_index = (type_index[1] + 1) % len(self._media_library.artists)
            self.play_file(type_index[0], (folder_index, artist_index, album_index, 0))

    def prev_branch(self):
        if self._current_disk_type == MediaPlayer.DiskType.AUDIO_CD:
            self.prev_track()
        elif self._current_disk_type == MediaPlayer.DiskType.MP3_CD:
            type_index = self._current_media_library_branch_type_index
            folder_index = None
            artist_index = None
            album_index = None
            if type_index[0] == MediaPlayer.BranchType.FOLDERS:
                folder_index = type_index[1] - 1
                folder_index = folder_index if folder_index != -1 else len(self._media_library.media_folders) - 1
            elif type_index[0] == MediaPlayer.BranchType.ALBUMS:
                album_index = type_index[2] - 1
                if album_index == -1:
                    artist_index = type_index[1] - 1
                    artist_index = artist_index if artist_index != -1 else len(self._media_library.artist) - 1
                    album_index = len(self._media_library.artists[artist_index].albums) - 1
            elif type_index[0] == MediaPlayer.BranchType.ARTISTS:
                artist_index = type_index[1] - 1
                artist_index = artist_index if artist_index != -1 else len(self._media_library.artists) - 1
            self.play_file(type_index[0], (folder_index, artist_index, album_index, 0))

    def play_track(self, track_number):
        if self._current_disk_type == MediaPlayer.DiskType.AUDIO_CD:
            self._run_command('set', 'chapter', str(track_number))
        elif self._current_disk_type == MediaPlayer.DiskType.MP3_CD:
            self._run_command('set', 'playlist-pos', str(track_number))
        self._put_info_with_delay()

    def play_file(self, media_library_type, indexes):
        # indexes = (folder_index, artist_index, album_index, file_index)
        if self._current_disk_type == MediaPlayer.DiskType.MP3_CD and \
                        media_library_type is not None and \
                        indexes is not None:
            files = None
            if media_library_type == MediaPlayer.BranchType.FOLDERS:
                self._current_media_library_branch_type_index = (MediaPlayer.BranchType.FOLDERS,
                                                                 indexes[0])
                files = self._media_library.media_folders[indexes[0]].media_files
            elif media_library_type == MediaPlayer.BranchType.ALBUMS:
                self._current_media_library_branch_type_index = (MediaPlayer.BranchType.ALBUMS,
                                                                 indexes[1],
                                                                 indexes[2])
                files = self._media_library.artists[indexes[1]].albums[indexes[2]].songs
            elif media_library_type == MediaPlayer.BranchType.ARTISTS:
                self._current_media_library_branch_type_index = (MediaPlayer.BranchType.ARTISTS,
                                                                 indexes[1])
                files = self._media_library.artists[indexes[1]].songs
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

    def volume_up(self):
        self._volume = (self._volume + 5) % 101
        self._run_command('set', 'volume', str(self._volume))
        self._info_events.put(self.get_current_info(False, False, True, False, False))

    def volume_down(self):
        volume = self._volume - 5
        volume = volume if volume >= 0 else 0
        self._volume = volume
        self._run_command('set', 'volume', str(self._volume))
        self._info_events.put(self.get_current_info(False, False, True, False, False))

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
        subprocess.call(['umount', '/dev/' + self._config['USB_DEVICE']])
        self._current_disk_type = None
        self._current_track = 0
        self._current_track_list = None
        self._current_media_library_branch_type_index = None
        self._media_library = None
        self.eject()

    def eject(self):
        subprocess.Popen(['eject', self._config['CD_DEVICE']])

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
    """
    Represents CD drive and disc inside.
    """

    def __init__(self):
        self._numtracks = 0
        self._track_lengths = []
        self._cd_info = None

    def load_cd_info(self):
        # JH - added code to query musicbrainz for disk info, build track list and times from that info
        # instead of the cd-discid output, if available.
        track_offsets = []
        try:
            this_disc = libdiscid.read('/dev/cdrom')
        except:
            print('DiskID could not read /dev/cdrom')
            self._numtracks = 0
            self._track_lengths = []
            self._cd_info = None
            return
        try:
            m.set_useragent('raspberry-pi-cdplayer', '0.2', 'https://github.com/JoeHartley3/raspberry-pi-cdplayer')
            self._cd_info = m.get_releases_by_discid(this_disc.id, includes=["recordings", "artists"])
            self._numtracks = self._cd_info['disc']['offset-count']
            print(self._numtracks)
            track_offsets = self._cd_info['disc']['offset-list']
            # Append the total time to the track_offsets
            track_offsets.append(int(self._cd_info['disc']['sectors']))
        except m.ResponseError:
            print("Disk not found or database unavailable")
            discid = subprocess.getstatusoutput('cd-discid --musicbrainz')
            if discid[0] == 0:
                output_split = discid[1].split()
                self._numtracks = int(output_split[0])
                track_offsets = list(map(lambda i: int(i), output_split[1:]))
        try:
            self._track_lengths = list(
                map(lambda i, offsets=track_offsets: int((offsets[i + 1] - offsets[i]) * 1000 / 75),
                    range(0, self._numtracks)))
        except:
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
