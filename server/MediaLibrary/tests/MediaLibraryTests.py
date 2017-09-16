import unittest
from MediaLibrary import MediaLibrary
from timeit import default_timer as timer

ROOT = 'D:\OneDrive\Hudba\Arjen Anthony Lucassen'
FOLDERS_COUNT = 23

class FoldersLengthTestCase(unittest.TestCase):
    def test(self):
        media_finder = MediaLibrary(ROOT)
        media_finder.init()
        self.assertEqual(len(media_finder.media_folders), FOLDERS_COUNT)

"""
Print folders (not real test)
"""
media_finder = MediaLibrary(ROOT)
start = timer()
media_finder.init()
end = timer()
for artist in media_finder.artists:
    print(str(artist) + ':')
    for album in artist.albums:
        print('  ' + str(album) + ':')
        for song in album.songs:
            print('    ' + str(song))

print('init executing time: ' + str(end - start))


if __name__ == '__main__':
    unittest.main()


