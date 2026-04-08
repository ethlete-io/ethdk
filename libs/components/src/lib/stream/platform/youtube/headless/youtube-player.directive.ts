import { isPlatformBrowser } from '@angular/common';
import {
  Directive,
  InjectionToken,
  DOCUMENT,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { injectHostElement, injectRenderer } from '@ethlete/core';
import { EMPTY, Observable, Subscription, interval, of, switchMap } from 'rxjs';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from '../../../stream-player';
import { injectStreamScriptLoader } from '../../../stream-script-loader';
import { DEFAULT_STREAM_PLAYER_STATE, StreamPlayerCapabilities, StreamPlayerState } from '../../../stream.types';
import { YoutubePlayerParamsDirective } from './youtube-player-params.directive';
import { YtPlayer, YtWindow } from './youtube-player.types';

const YT_API_URL = 'https://www.youtube.com/iframe_api';

export const YOUTUBE_PLAYER_TOKEN = new InjectionToken<YoutubePlayerDirective>('YOUTUBE_PLAYER_TOKEN');

const waitForYtReady = (win: YtWindow): Observable<void> => {
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
  private renderer = injectRenderer();
  private document = inject(DOCUMENT);
  private params = inject(YoutubePlayerParamsDirective);

  readonly CAPABILITIES: StreamPlayerCapabilities = {
    canPlay: true,
    canPause: true,
    canMute: true,
    canSeek: true,
    canGetDuration: true,
    isLiveCapable: true,
    hasThumbnail: true,
  };

  state = signal<StreamPlayerState>({ ...DEFAULT_STREAM_PLAYER_STATE });
  thumbnail = computed(() => `https://img.youtube.com/vi/${this.params.videoId()}/mqdefault.jpg`);

  private playerResource = rxResource({
    params: () => (isPlatformBrowser(this.platformId) ? this.params.videoId() : null),
    stream: ({ params: videoId }) => {
      if (!videoId) return EMPTY;

      return this.scriptLoader.load(YT_API_URL).pipe(
        switchMap(() => waitForYtReady(this.document.defaultView as unknown as YtWindow)),
        switchMap(
          () =>
            new Observable<YtPlayer>((subscriber) => {
              const win = this.document.defaultView as unknown as YtWindow;

              if (isDevMode() && !win.YT?.Player) {
                console.error('[et-youtube-player] YT.Player not available after SDK load.');
              }

              let currentTimeSub: Subscription | null = null;

              const clearCurrentTimeInterval = () => {
                currentTimeSub?.unsubscribe();
                currentTimeSub = null;
              };

              const placeholder = this.renderer.createElement('div');
              this.renderer.appendChild(this.el, placeholder);

              const player = new win.YT.Player(placeholder, {
                videoId,
                width: this.params.width() as string,
                height: this.params.height() as string,
                playerVars: {
                  enablejsapi: 1,
                  origin: this.document.defaultView?.location.origin ?? '',
                  start: this.params.startTime() || undefined,
                  rel: 0,
                },
                events: {
                  onReady: () => {
                    this.state.set({ ...DEFAULT_STREAM_PLAYER_STATE, isReady: true, isLoading: false });
                    subscriber.next(player);
                  },
                  onStateChange: (event) => {
                    const yt = win.YT;
                    const s = event.data;
                    const isPlaying = s === yt.PlayerState.PLAYING;

                    clearCurrentTimeInterval();

                    if (isPlaying) {
                      currentTimeSub = interval(250).subscribe(() => {
                        this.state.update((prev) => ({
                          ...prev,
                          currentTime: player.getCurrentTime() ?? null,
                        }));
                      });
                    }

                    this.state.update((prev) => ({
                      ...prev,
                      isPlaying,
                      isEnded: s === yt.PlayerState.ENDED,
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
    this.playerResource.value()?.playVideo();
  }

  pause() {
    this.playerResource.value()?.pauseVideo();
  }

  mute() {
    this.playerResource.value()?.mute();
    this.state.update((s) => ({ ...s, isMuted: true }));
  }

  unmute() {
    this.playerResource.value()?.unMute();
    this.state.update((s) => ({ ...s, isMuted: false }));
  }

  seek(seconds: number) {
    this.playerResource.value()?.seekTo(seconds, true);
  }

  retry() {
    this.playerResource.reload();
  }
}
