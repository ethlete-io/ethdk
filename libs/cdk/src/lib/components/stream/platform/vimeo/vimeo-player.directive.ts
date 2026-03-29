import { isPlatformBrowser } from '@angular/common';
import {
  Directive,
  InjectionToken,
  PLATFORM_ID,
  computed,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { injectHostElement } from '@ethlete/core';
import { EMPTY, Observable, switchMap } from 'rxjs';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from '../../stream-player';
import { injectStreamScriptLoader } from '../../stream-script-loader';
import { StreamPlayerCapabilities, StreamPlayerState } from '../../stream.types';
import { VimeoPlaybackEvent, VimeoPlayer, VimeoWindow } from './vimeo-player.types';

const VIMEO_SDK_URL = 'https://player.vimeo.com/api/player.js';

export const VIMEO_PLAYER_TOKEN = new InjectionToken<VimeoPlayerDirective>('VIMEO_PLAYER_TOKEN');

const DEFAULT_STATE: StreamPlayerState = {
  isReady: false,
  isPlaying: false,
  isMuted: false,
  isEnded: false,
  duration: null,
  currentTime: null,
};

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

  readonly CAPABILITIES: StreamPlayerCapabilities = {
    canPlay: true,
    canPause: true,
    canMute: true,
    canSeek: true,
    canGetDuration: true,
    isLiveCapable: true,
    hasThumbnail: false,
  };

  state = signal<StreamPlayerState>({ ...DEFAULT_STATE });
  thumbnail = signal<string | null>(null);

  videoId = input.required<string | number>();
  startTime = input(0, { transform: numberAttribute });
  width = input<string | number>('100%');
  height = input<string | number>('100%');

  private playerResource = rxResource({
    params: () => (isPlatformBrowser(this.platformId) ? this.videoId() : null),
    stream: ({ params: videoId }) => {
      if (!videoId) return EMPTY;

      return this.scriptLoader.load(VIMEO_SDK_URL).pipe(
        switchMap(
          () =>
            new Observable<VimeoPlayer>((subscriber) => {
              const win = window as unknown as VimeoWindow;
              const startTime = this.startTime();
              let active = true;

              // Vimeo width/height options only accept numbers (pixels).
              // Apply %/px sizing to the host element and let the iframe fill it.
              const w = this.width();
              const h = this.height();
              this.el.style.display = 'block';
              this.el.style.width = typeof w === 'number' ? `${w}px` : w;
              this.el.style.height = typeof h === 'number' ? `${h}px` : h;

              // responsive: true makes the iframe fill 100% of the host element.
              // Dimensions are applied to the host element via CSS above.
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

              player.on('play', onPlay);
              player.on('pause', onPause);
              player.on('ended', onEnded);
              player.on('timeupdate', onTimeUpdate);

              player
                .ready()
                .then(() => player.getMuted())
                .then((isMuted) => {
                  if (!active) return;
                  this.state.set({ ...DEFAULT_STATE, isReady: true, isMuted });
                  if (startTime > 0) player.setCurrentTime(startTime);
                  subscriber.next(player);
                });

              return () => {
                active = false;
                player.off('play', onPlay);
                player.off('pause', onPause);
                player.off('ended', onEnded);
                player.off('timeupdate', onTimeUpdate);
                player.destroy();
                this.state.set({ ...DEFAULT_STATE });
              };
            }),
        ),
      );
    },
  });

  error = computed(() => (this.playerResource.isLoading() ? undefined : this.playerResource.error()));

  play(): void {
    this.playerResource.value()?.play();
  }

  pause(): void {
    this.playerResource.value()?.pause();
  }

  mute(): void {
    this.playerResource
      .value()
      ?.setMuted(true)
      .then(() => this.state.update((s) => ({ ...s, isMuted: true })));
  }

  unmute(): void {
    this.playerResource
      .value()
      ?.setMuted(false)
      .then(() => this.state.update((s) => ({ ...s, isMuted: false })));
  }

  seek(seconds: number): void {
    this.playerResource.value()?.setCurrentTime(seconds);
  }

  retry(): void {
    this.playerResource.reload();
  }
}
