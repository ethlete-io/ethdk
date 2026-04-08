import { isPlatformBrowser } from '@angular/common';
import { Directive, InjectionToken, DOCUMENT, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { injectHostElement, injectRenderer } from '@ethlete/core';
import { EMPTY, Observable, switchMap } from 'rxjs';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from '../../../stream-player';
import { injectStreamScriptLoader } from '../../../stream-script-loader';
import { DEFAULT_STREAM_PLAYER_STATE, StreamPlayerCapabilities, StreamPlayerState } from '../../../stream.types';
import { VimeoPlayerParamsDirective } from './vimeo-player-params.directive';
import { VimeoDurationChangeEvent, VimeoPlaybackEvent, VimeoPlayer, VimeoWindow } from './vimeo-player.types';

const VIMEO_SDK_URL = 'https://player.vimeo.com/api/player.js';

export const VIMEO_PLAYER_TOKEN = new InjectionToken<VimeoPlayerDirective>('VIMEO_PLAYER_TOKEN');

@Directive({
  providers: [
    { provide: VIMEO_PLAYER_TOKEN, useExisting: VimeoPlayerDirective },
    { provide: STREAM_PLAYER_TOKEN, useExisting: VimeoPlayerDirective },
  ],
})
export class VimeoPlayerDirective implements StreamPlayer {
  private el = injectHostElement();
  private scriptLoader = injectStreamScriptLoader();
  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);
  private renderer = injectRenderer();
  private params = inject(VimeoPlayerParamsDirective);

  readonly CAPABILITIES: StreamPlayerCapabilities = {
    canPlay: true,
    canPause: true,
    canMute: true,
    canSeek: true,
    canGetDuration: true,
    isLiveCapable: true,
    hasThumbnail: false,
  };

  state = signal<StreamPlayerState>({ ...DEFAULT_STREAM_PLAYER_STATE });
  thumbnail = signal<string | null>(null);

  private playerResource = rxResource({
    params: () => (isPlatformBrowser(this.platformId) ? this.params.videoId() : null),
    stream: ({ params: videoId }) => {
      if (!videoId) return EMPTY;

      return this.scriptLoader.load(VIMEO_SDK_URL).pipe(
        switchMap(
          () =>
            new Observable<VimeoPlayer>((subscriber) => {
              const win = this.document.defaultView as unknown as VimeoWindow;
              const startTime = this.params.startTime();
              let active = true;

              const w = this.params.width();
              const h = this.params.height();
              this.renderer.setStyle(this.el, {
                display: 'block',
                width: typeof w === 'number' ? `${w}px` : w,
                height: typeof h === 'number' ? `${h}px` : h,
              });

              const player = new win.Vimeo.Player(this.el, { id: videoId, responsive: true });

              const onPlay = (data: unknown) => {
                const e = data as VimeoPlaybackEvent;
                this.state.update((s) => ({
                  ...s,
                  isPlaying: true,
                  isEnded: false,
                  duration: e.duration,
                  currentTime: e.seconds,
                }));
              };

              const onPause = (data: unknown) => {
                const e = data as VimeoPlaybackEvent;
                this.state.update((s) => ({ ...s, isPlaying: false, currentTime: e.seconds }));
              };

              const onEnded = (data: unknown) => {
                const e = data as VimeoPlaybackEvent;
                this.state.update((s) => ({ ...s, isPlaying: false, isEnded: true, currentTime: e.seconds }));
              };

              const onTimeUpdate = (data: unknown) => {
                const e = data as VimeoPlaybackEvent;
                this.state.update((s) => ({ ...s, duration: e.duration, currentTime: e.seconds }));
              };

              const onDurationChange = (data: unknown) => {
                const e = data as VimeoDurationChangeEvent;
                this.state.update((s) => ({ ...s, duration: e.duration }));
              };

              const onVolumeChange = () => {
                player.getMuted().then((isMuted) => {
                  if (!active) return;
                  this.state.update((s) => ({ ...s, isMuted }));
                });
              };

              player.on('play', onPlay);
              player.on('pause', onPause);
              player.on('ended', onEnded);
              player.on('timeupdate', onTimeUpdate);
              player.on('durationchange', onDurationChange);
              player.on('volumechange', onVolumeChange);

              player
                .ready()
                .then(() => Promise.all([player.getMuted(), player.getDuration()]))
                .then(([isMuted, duration]) => {
                  if (!active) return;
                  this.state.set({
                    ...DEFAULT_STREAM_PLAYER_STATE,
                    isReady: true,
                    isLoading: false,
                    isMuted,
                    duration: isFinite(duration) ? duration : null,
                  });
                  if (startTime > 0) player.setCurrentTime(startTime);
                  subscriber.next(player);
                })
                .catch((err: unknown) => {
                  if (active) subscriber.error(err);
                });

              return () => {
                active = false;
                player.off('play', onPlay);
                player.off('pause', onPause);
                player.off('ended', onEnded);
                player.off('timeupdate', onTimeUpdate);
                player.off('durationchange', onDurationChange);
                player.off('volumechange', onVolumeChange);
                player.destroy();
                this.state.set({ ...DEFAULT_STREAM_PLAYER_STATE });
              };
            }),
        ),
      );
    },
  });

  constructor() {
    effect(() => {
      const error = this.playerResource.error();
      this.state.update((s) => ({
        ...s,
        isLoading: error !== undefined ? false : this.playerResource.isLoading(),
        error: error ?? null,
      }));
    });
  }

  play() {
    this.playerResource.value()?.play();
  }

  pause() {
    this.playerResource.value()?.pause();
  }

  mute() {
    this.playerResource.value()?.setMuted(true);
  }

  unmute() {
    this.playerResource.value()?.setMuted(false);
  }

  seek(seconds: number) {
    this.playerResource.value()?.setCurrentTime(seconds);
  }

  retry() {
    this.playerResource.reload();
  }
}
