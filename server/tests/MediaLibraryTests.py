import unittest
from timeit import default_timer as timer

from classes.MediaLibrary import MediaLibrary

ROOT = 'D:\OneDrive\Hudba\Arjen Anthony Lucassen'
FOLDERS_COUNT = 23

media_library = MediaLibrary()

class FoldersLengthTestCase(unittest.TestCase):
    def test(self):
        media_finder = MediaLibrary()
        media_finder.init(ROOT)
        self.assertEqual(len(media_finder.media_folders), FOLDERS_COUNT)

"""
Print folders (not real test)
"""
start = timer()
media_library.init(ROOT)
end = timer()
print(media_library.as_dict())

print('init executing time: ' + str(end - start))


if __name__ == '__main__':
    unittest.main()


