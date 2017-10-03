import pifacecad
from threading import Thread, Barrier, BrokenBarrierError, Timer
from math import floor


class MediaPlayerPiFaceCAD:
    def __init__(self, media_player):
        self._cad = pifacecad.PiFaceCAD()
        self._media_player = media_player
        self._switch_listener = pifacecad.SwitchEventListener()
        self._write_count = 0
        self._temp_text = None
        self._temp_text_Timer = None

        # https://github.com/piface/pifacedigitalio/issues/27
        self._switch_listener_barrier = Barrier(2)
        self._switch_listener_wait_for_deactivation_thread = Thread(target=self._switch_listener_wait_for_deactivation,
                                                                    args=[])
        self._switch_listener_wait_for_deactivation_thread.setDaemon(True)
        self._switch_listener_wait_for_deactivation_thread.start()

        self._switch_listener.register(0, pifacecad.IODIR_ON,
                                       lambda event: self._clear_and_call(media_player.prev_track))
        self._switch_listener.register(1, pifacecad.IODIR_ON,
                                       lambda event: media_player.play_pause())
        self._switch_listener.register(2, pifacecad.IODIR_ON,
                                       lambda event: media_player.play_pause())
        self._switch_listener.register(3, pifacecad.IODIR_ON,
                                       lambda event: self._clear_and_call(media_player.next_track))
        self._switch_listener.register(4, pifacecad.IODIR_ON,
                                       lambda event: self._stop(media_player))
        self._switch_listener.register(5, pifacecad.IODIR_ON,
                                       lambda event: media_player.play_pause())
        self._switch_listener.register(6, pifacecad.IODIR_ON,
                                       lambda event: self._clear_and_call(media_player.prev_track))
        self._switch_listener.register(7, pifacecad.IODIR_ON,
                                       lambda event: self._clear_and_call(media_player.next_track))
        self._switch_listener.activate()
        self._cad.lcd.blink_off()
        self._cad.lcd.cursor_off()
        self._cad.lcd.clear()
        self._cad.lcd.backlight_on()
        self._cad.lcd.write('Waiting for CD')

    def _switch_listener_wait_for_deactivation(self):
        try:
            self._switch_listener_barrier.wait()
        except BrokenBarrierError:
            pass  # expected reset
        self._switch_listener.deactivate()

    def _clear_and_call(self, func):
        self._cad.lcd.clear()
        func()

    def _stop(self, media_player):
        media_player.stop()
        self.destroy()

    def destroy(self):
        self._cad.lcd.clear()
        self._cad.lcd.backlight_off()
        self._switch_listener_barrier.reset()  # should never wait

    def _reset_temp_text(self):
        self._temp_text = None

    def set_temp_text(self, temp_text):
        self._temp_text = temp_text
        if self._temp_text_Timer is not None:
            self._temp_text_Timer.cancel()
        self._temp_text_Timer = Timer(1, lambda: self._reset_temp_text())
        self._temp_text_Timer.start()

    def write_info(self, media_player_info):
        # clear every 100 writes otherwise LCD starts to blink
        if self._write_count == 20:
            self._write_count = 0
            self._cad.lcd.clear()
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
                self._cad.lcd.set_cursor(16 - track_str_len, 1)
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
            self._cad.lcd.write(self._temp_text + '                ')
        else:
            self._cad.lcd.write(first_row_text + '                ')
        self._write_count += 1

    @staticmethod
    def create_eject_listener(media_player):
        eject_listener = pifacecad.SwitchEventListener()
        eject_listener.register(4, pifacecad.IODIR_ON,
                                lambda event: media_player.eject())
        eject_listener.activate()
        return eject_listener
