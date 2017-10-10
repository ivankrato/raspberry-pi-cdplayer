import pifacecad
from threading import Thread, Barrier, BrokenBarrierError, Timer
from time import sleep
from math import floor


class MediaPlayerPiFaceCAD:
    def __init__(self):
        self._cad = pifacecad.PiFaceCAD()
        self._cad.lcd.blink_off()
        self._cad.lcd.cursor_off()
        self._media_player = None
        self._switch_listener = pifacecad.SwitchEventListener()
        self._ir_listener = pifacecad.IREventListener('raspberry-pi-cdplayer')
        self._temp_text = None
        self._temp_text_Timer = None

        # https://github.com/piface/pifacedigitalio/issues/27
        self._listeners_barrier = Barrier(2)
        self._listeners_wait_for_deactivation_thread = Thread(target=self._switch_listener_wait_for_deactivation,
                                                              args=[])
        self._listeners_wait_for_deactivation_thread.setDaemon(True)
        self._write_info_thread = Thread(target=self._write_info_thread_func)
        self._write_info_thread.setDaemon(True)

    def init(self, media_player):
        self._media_player = media_player
        self._listeners_wait_for_deactivation_thread.start()
        self._switch_listener.register(0, pifacecad.IODIR_ON,
                                       lambda event: self._clear_and_call(media_player.prev_branch))
        self._switch_listener.register(1, pifacecad.IODIR_ON,
                                       lambda event: self._clear_and_call(media_player.next_branch))
        self._switch_listener.register(2, pifacecad.IODIR_ON,
                                       lambda event: media_player.volume_down())
        self._switch_listener.register(3, pifacecad.IODIR_ON,
                                       lambda event: media_player.volume_up())
        self._switch_listener.register(5, pifacecad.IODIR_ON,
                                       lambda event: media_player.play_pause())
        self._switch_listener.register(6, pifacecad.IODIR_ON,
                                       lambda event: self._clear_and_call(media_player.prev_track))
        self._switch_listener.register(7, pifacecad.IODIR_ON,
                                       lambda event: self._clear_and_call(media_player.next_track))
        self._switch_listener.activate()
        self._ir_listener.register('play_pause', lambda event: callAndSleep(media_player.play_pause))
        self._ir_listener.register('next_track',
                                   lambda event: callAndSleep(self._clear_and_call, media_player.next_track))
        self._ir_listener.register('prev_track',
                                   lambda event: callAndSleep(self._clear_and_call, media_player.prev_track))
        self._ir_listener.register('next_branch',
                                   lambda event: callAndSleep(self._clear_and_call, media_player.next_branch))
        self._ir_listener.register('prev_branch',
                                   lambda event: callAndSleep(self._clear_and_call, media_player.prev_branch))
        self._ir_listener.register('eject', lambda event: callAndSleep(media_player.stop))
        self._ir_listener.register('volume_up', lambda event: callAndSleep(media_player.volume_up))
        self._ir_listener.register('volume_down', lambda event: callAndSleep(media_player.volume_down))
        self._ir_listener.activate()
        self._cad.lcd.clear()
        self._cad.lcd.backlight_on()
        self._cad.lcd.write('Loading')
        self._write_info_thread.start()

    def _write_info_thread_func(self):
        while self._media_player.is_running:
            self.write_info(self._media_player.get_current_info())
            sleep(0.8)

    def _switch_listener_wait_for_deactivation(self):
        try:
            self._listeners_barrier.wait()
        except BrokenBarrierError:
            pass  # expected reset
        self._switch_listener.deactivate()
        self._ir_listener.deactivate()

    def _clear_and_call(self, func):
        self._cad.lcd.clear()
        func()

    def destroy(self):
        self._cad.lcd.clear()
        self._cad.lcd.backlight_off()
        self._listeners_barrier.reset()  # should never wait

    def _reset_temp_text(self):
        self._temp_text = None

    def set_temp_text(self, temp_text):
        self._temp_text = temp_text
        if self._temp_text_Timer is not None:
            self._temp_text_Timer.cancel()
        self._temp_text_Timer = Timer(1, lambda: self._reset_temp_text())
        self._temp_text_Timer.start()

    def write_info(self, media_player_info):
        first_row_text = ''
        if media_player_info.status == 'paused':
            first_row_text = 'Paused'
        elif media_player_info.status == 'waitingForCD':
            self._cad.lcd.clear()
            first_row_text = 'Waiting for CD'
        elif media_player_info.status == 'playing' and media_player_info.cur_track_info is not None:
            if media_player_info.cur_track_info.track_number is not None:
                track_list = self._media_player.current_track_list
                # track name
                track_info = track_list[media_player_info.cur_track_info.track_number]
                first_row_text = track_info.artist + ' - ' + track_info.title
                # track count
                total_tracks = len(track_list)
                cur_track = media_player_info.cur_track_info.track_number + 1
                track_str_len = len(str(cur_track)) + len(str(total_tracks)) + 1
                self._cad.lcd.set_cursor(9, 1)
                if track_str_len < 7:
                    for i in range(0, 7 - track_str_len):
                        self._cad.lcd.write(' ')
                self._cad.lcd.write(str(cur_track) + '/' + str(total_tracks))
            if media_player_info.cur_track_info.cur_time is not None:
                # track time
                cur_track_time_total_millis = media_player_info.cur_track_info.cur_time
                cur_track_time_total_seconds = floor(cur_track_time_total_millis / 1000)
                cur_track_time_minutes = str(floor(cur_track_time_total_seconds / 60))
                cur_track_time_seconds = str(cur_track_time_total_seconds % 60)
                self._cad.lcd.set_cursor(0, 1)
                self._cad.lcd.write(cur_track_time_minutes.zfill(2) + ':' + cur_track_time_seconds.zfill(2))
        self._cad.lcd.home()
        if self._temp_text is not None:
            self._cad.lcd.write((self._temp_text + '                ')[:16])
        else:
            self._cad.lcd.write((first_row_text + '                ')[:16])

    @staticmethod
    def create_eject_listener(media_player):
        eject_listener = pifacecad.SwitchEventListener()
        eject_listener.register(4, pifacecad.IODIR_ON,
                                lambda event: media_player.stop())
        eject_listener.activate()
        return eject_listener


def callAndSleep(func, *args):
    func(*args)
    sleep(0.2)
