DEFAULT_ARTIST = "Unknown Artist"
DEFAULT_ALBUM = "Unknown Album"
DEFAULT_TITLE = "Track"


class MediaPlayerInfo:
    def __init__(self):
        self.status = None
        self.cur_track_info = None
        self.track_list = None
        self.library = None

    def as_dict(self):
        _dict = {
            'status': self.status,
            'track_list': self.track_list
        }
        if self.cur_track_info is not None:
            _dict['cur_track_info'] = self.cur_track_info.as_dict()
        if self.library is not None:
            _dict['library'] = self.library.as_dict()
        return _dict


class CurrentTrackInfo:
    def __init__(self, cur_time=None, track_number=None):
        self.cur_time = cur_time
        self.track_number = track_number

    def as_dict(self):
        return {
            'cur_time': self.cur_time,
            'track_number': self.track_number
        }


class TrackInfo:
    def __init__(self, total_time=None, artist=DEFAULT_ARTIST, album=DEFAULT_ALBUM, title=DEFAULT_TITLE):
        self.total_time = total_time
        self.artist = artist
        self.album = album
        self.title = title

    def as_dict(self):
        return {
            'total_time': self.total_time,
            'artist': self.artist,
            'album': self.album,
            'title': self.title
        }
