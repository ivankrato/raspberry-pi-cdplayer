class MediaPlayerConfig:
    def __init__(self, file_path):
        self._config_dict = {}
        with open(file_path) as file:
            for line in file:
                line.rstrip('\n')
                if line.startswith('#') or len(line) == 0:
                    continue
                ar = line.split('=')
                self._config_dict[ar[0]] = ar[1]

    def get(self, key):
        try:
            return self._config_dict[key]
        except KeyError:
            return None

    def __getitem__(self, key):
        return self.get(key)
