import { isPlatformBrowser } from '@angular/common';
import {
  Directive,
  InjectionToken,
  PLATFORM_ID,
  computed,
  inject,
  input,
  isDevMode,
  numberAttribute,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { injectHostElement } from '@ethlete/core';
import { EMPTY, Observable, of, switchMap } from 'rxjs';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from '../../stream-player';
import { injectStreamScriptLoader } from '../../stream-script-loader';
import { StreamPlayerCapabilities, StreamPlayerState } from '../../stream.types';
import { YtPlayer, YtWindow } from './youtube-player.types';

const YT_API_URL = 'https://www.youtube.com/iframe_api';

export const YOUTUBE_PLAYER_TOKEN = new InjectionToken<YoutubePlayerDirective>('YOUTUBE_PLAYER_TOKEN');

const DEFAULT_STATE: StreamPlayerState = {
  isReady: false,
  isPlaying: false,
  isMuted: false,
  isEnded: false,
  duration: null,
  currentTime: null,
};

const waitForYtReady = (): Observable<void> => {
  const win = window as unknown as YtWindow;
  if (win.YT?.Player) return of(undefined);

  return new Observable<void>((subscriber) => {
    const prev = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => {
      prev?.();
      subscriber.next();
      subscriber.complete();
    };
  });
};

@Directive({
  providers: [
    { provide: YOUTUBE_PLAYER_TOKEN, useExisting: YoutubePlayerDirective },
    { provide: STREAM_PLAYER_TOKEN, useExisting: YoutubePlayerDirective },
  ],
})
export class YoutubePlayerDirective implements StreamPlayer {
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
  };

  state = signal<StreamPlayerState>({ ...DEFAULT_STATE });

  videoId = input.required<string>();
  startTime = input(0, { transform: numberAttribute });
  width = input<string | number>('100%');
  height = input<string | number>('100%');

  private playerResource = rxResource({
    params: () => (isPlatformBrowser(this.platformId) ? this.videoId() : null),
    stream: ({ params: videoId }) => {
      if (!videoId) return EMPTY;

      return this.scriptLoader.load(YT_API_URL).pipe(
        switchMap(() => waitForYtReady()),
        switchMap(
          () =>
            new Observable<YtPlayer>((subscriber) => {
              const win = window as unknown as YtWindow;

              if (isDevMode() && !win.YT?.Player) {
                console.error('[et-youtube-player] YT.Player not available after SDK load.');
              }

              let currentTimeInterval: ReturnType<typeof setInterval> | null = null;

              const clearCurrentTimeInterval = () => {
                if (currentTimeInterval !== null) {
                  clearInterval(currentTimeInterval);
                  currentTimeInterval = null;
                }
              };

              const player = new win.YT.Player(this.el, {
                videoId,
                width: this.width() as string,
                height: this.height() as string,
                playerVars: {
                  enablejsapi: 1,
                  origin: window.location.origin,
                  start: this.startTime() || undefined,
                  rel: 0,
                },
                events: {
                  onReady: () => {
                    this.state.set({ ...DEFAULT_STATE, isReady: true });
                    subscriber.next(player);
                  },
                  onStateChange: (event) => {
                    const YT = win.YT;
                    const s = event.data;
                    const isPlaying = s === YT.PlayerState.PLAYING;

                    clearCurrentTimeInterval();

                    if (isPlaying) {
                      currentTimeInterval = setInterval(() => {
                        this.state.update((prev) => ({
                          ...prev,
                          currentTime: player.getCurrentTime() ?? null,
                        }));
                      }, 250);
                    }

                    this.state.update((prev) => ({
                      ...prev,
                      isPlaying,
                      isEnded: s === YT.PlayerState.ENDED,
                      duration: player.getDuration() ?? null,
                      currentTime: player.getCurrentTime() ?? null,
                      isMuted: player.isMuted(),
                    }));
                  },
                },
              });

              return () => {
                clearCurrentTimeInterval();
                player.destroy();
                this.state.set({ ...DEFAULT_STATE });
              };
            }),
        ),
      );
    },
  });

  readonly error = computed(() => (this.playerResource.isLoading() ? undefined : this.playerResource.error()));

  play(): void {
    this.playerResource.value()?.playVideo();
  }

  pause(): void {
    this.playerResource.value()?.pauseVideo();
  }

  mute(): void {
    this.playerResource.value()?.mute();
    this.state.update((s) => ({ ...s, isMuted: true }));
  }

  unmute(): void {
    this.playerResource.value()?.unMute();
    this.state.update((s) => ({ ...s, isMuted: false }));
  }

  seek(seconds: number): void {
    this.playerResource.value()?.seekTo(seconds, true);
  }

  retry(): void {
    this.playerResource.reload();
  }
}
