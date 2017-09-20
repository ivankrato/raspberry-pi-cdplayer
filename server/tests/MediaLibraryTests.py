import unittest
from timeit import default_timer as timer

from classes.MediaLibrary import MediaLibrary

ROOT = 'D:\OneDrive\Hudba\Arjen Anthony Lucassen'
FOLDERS_COUNT = 23

media_finder = MediaLibrary()

class FoldersLengthTestCase(unittest.TestCase):
    def test(self):
        media_finder = MediaLibrary()
        media_finder.init(ROOT)
        self.assertEqual(len(media_finder.media_folders), FOLDERS_COUNT)

"""
Print folders (not real test)
"""
start = timer()
media_finder.init(ROOT)
end = timer()
for artist in media_finder.artists:
    print(str(artist) + ':')
    for album in artist.albums:
        print('  ' + str(album) + ':')
        for song in album.songs:
            print('    ' + str(song) + ' - ' + str(song.total_time))

print('init executing time: ' + str(end - start))


if __name__ == '__main__':
    unittest.main()


