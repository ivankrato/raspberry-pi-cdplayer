class MediaPlayerConfig:
    """
    Parses and represents config file.
    """
    def __init__(self, file_path):
        self._config_dict = {}
        with open(file_path) as file:
            lines = file.read().splitlines()
            for line in lines:
                if line.startswith('#'):
                    continue
                ar = line.split('=')
                try:
                    self._config_dict[ar[0]] = ar[1]
                except IndexError:
                    # syntax error, ignore the line
                    pass

    def get(self, key):
        try:
            return self._config_dict[key]
        except KeyError:
            return None

    def __getitem__(self, key):
        return self.get(key)
