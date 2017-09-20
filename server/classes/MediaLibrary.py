import os
from mutagen.mp3 import EasyMP3


class MediaLibrary:
    """
    Class MediaLibrary represents a finder that searchs for media (MP3) files
    and puts them into a tree of folders/files and artists/albums/songs
    """

    def __init__(self):
        """
        Constructor, initializes the MediaLibrary class with a root folder
        :param root_folder: folder to be searched in
        """
        self._root_folder = ''
        self._media_file_count = 0
        self._media_folders = []
        self._artists = []

    def init(self, root_folder):
        """
        Searches for the media in root folder and initializes the media tree
        :return: None
        """
        self._root_folder = root_folder
        self._media_file_count = 0
        self._media_folders = []
        self._artists = []
        print(root_folder)
        for subdir, dirs, files in os.walk(self._root_folder):
            media_folder = MediaLibrary.MediaFolder(subdir)
            for file in files:
                if file.endswith('.mp3'):
                    media_file = MediaLibrary.MediaFile(file, subdir)
                    media_file.init_tags()
                    # adds folders and files
                    if media_folder not in self._media_folders:
                        # if folder is not in the tree yet, add it
                        self._media_folders.append(media_folder)
                    media_folder.add_media_file(media_file)
                    # adds artists and albums
                    artist = next((x for x in self._artists if x.name == media_file.artist), None)
                    if artist is None:
                        # if artist is not in the tree yet, add it
                        artist = MediaLibrary.Artist(media_file.artist)
                        self._artists.append(artist)
                    album = next((x for x in artist.albums if x.name == media_file.album), None)
                    if album is None:
                        # if album is not in the tree yet, add it
                        album = MediaLibrary.Album(media_file.album)
                        artist.add_album(album)
                    album.add_song(media_file)
                    self._media_file_count += 1

    @property
    def media_folders(self):
        """
        Array, contains MediaFolder instances
        :return: array with MediaFolder instances
        """
        return self._media_folders

    @property
    def artists(self):
        """
        Array, contains MediaBranch instances with artists
        :return: array with MediaBranch instances with artists
        """
        return self._artists

    @property
    def media_file_count(self):
        """
        Number of media in this library
        :return: number of media in this library
        """
        return self._media_file_count

    class MediaBranch:
        """
        Class MediaFolder represents a folder which contains some media (MP3).
        Used by MediaLibrary.
        """

        def __init__(self, name, last=False):
            """
            Constructor, initializes MediaFolder with path
            :param path: str path to the folder
            """
            self._name = name
            self._media_files = []
            self._media_branches = []

        def _add_media_file(self, media_file):
            """
            adds MediaFile to the MediaFolder
            :param media_file: str MediaFile instance
            :return: None
            """
            self._media_files.append(media_file)

        def _add_branch(self, media_branch):
            """
            adds MediaBranch to this MediaBranch
            :param media_branch: MediaBranch instance
            :return: None
            """
            self._media_branches.append(media_branch)

        def __str__(self):
            return self._name

        @property
        def name(self):
            """
            Property, name of the folder
            :return: str name of the folder
            """
            return self._name

    class MediaFolder(MediaBranch):
        """
        Class Artist inherits MediaBranch represents an artist with some albums
        """

        def __init__(self, path):
            """
            Constructor, initializes Artist with a name
            :param name: 
            """
            self._path = path
            super().__init__(path.split(os.sep)[-1])
            self.add_media_file = self._add_media_file

        @property
        def media_files(self):
            """
            Array, contains MediaFile instances
            :return: array of MediaFile instances
            """
            return self._media_files

    class Artist(MediaBranch):
        """
        Class Artist inherits MediaBranch represents an artist with some albums
        """

        def __init__(self, name):
            """
            Constructor, initializes Artist with a name
            :param name: 
            """
            super().__init__(name)
            self._albums = self._media_branches
            self.add_album = self._add_branch

        @property
        def albums(self):
            """
            Array, contains Album instances
            :return: array of Album instances
            """
            return self._albums

    class Album(MediaBranch):
        """
        Class Album inherits MediaBranch represents an album with some media files
        """

        def __init__(self, name):
            """
            Constructor, initializes Album with a name
            :param name: 
            """
            super().__init__(name)
            self.add_song = self._add_media_file

        @property
        def songs(self):
            """
            Array, contains MediaFile instances
            :return: array of MediaFile instances
            """
            return self._media_files

    class MediaFile:
        """
        Class MediaFile represent a file that contains a piece of media (MP3).
        User by MediaLibrary.
        """
        DEFAULT_ARTIST = "Unknown Artist"
        DEFAULT_ALBUM = "Unknown Album"

        def __init__(self, file_name, folder_path):
            """
            Constructor, initializes MediaFiles with it's name and path to the folder the file is in
            :param file_name: str name of the file
            :param folder_path: str path to the folder the file is in
            """
            self._file_name_no_ext = os.path.splitext(file_name)[0]
            self._full_path = os.path.join(folder_path, file_name)
            self._artist = MediaLibrary.MediaFile.DEFAULT_ARTIST
            self._album = MediaLibrary.MediaFile.DEFAULT_ALBUM
            self._title = self._file_name_no_ext
            self._totalTime = 0

        def init_tags(self):
            """
            Initialize MediaFile with some of the ID3 tags from the file
            :return: None
            """
            try:
                media_info = EasyMP3(self._full_path)
                self._artist = media_info.tags.get("albumartist", media_info.tags.get("artist", self._artist))
                if type(self._artist) is list: self._artist = ','.join(self._artist)
                self._album = media_info.tags.get("album", self._album)
                if type(self._album) is list: self._album = ','.join(self._album)
                self._title = media_info.tags.get("title", self._title)
                if type(self._title) is list: self._title = ','.join(self._title)
                self._totalTime = round(media_info.info.length*1000) # we need milliseconds, not seconds
            except:
                # Default tags if file has no tags
                pass

        def __str__(self):
            return self._title

        @property
        def full_path(self):
            """
            Property, full path to the file
            :return: str with full path to the file
            """
            return self._full_path

        @property
        def artist(self):
            """
            Property, artist name
            :return: str artist name
            """
            return self._artist

        @property
        def album(self):
            """
            Property, album name
            :return: str album name
            """
            return self._album

        @property
        def title(self):
            """
            Property, title of the media
            :return: str title of the media
            """
            return self._title

        @property
        def total_time(self):
            """
            Property, total time of the media in milliseconds
            :return: number total time of the media in milliseconds
            """
            return self._totalTime
