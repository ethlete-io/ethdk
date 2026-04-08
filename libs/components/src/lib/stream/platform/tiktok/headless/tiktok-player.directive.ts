import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, Directive, InjectionToken, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RuntimeError, injectHostElement, injectRenderer } from '@ethlete/core';
import { EMPTY, Observable } from 'rxjs';
import { STREAM_ERROR_CODES } from '../../../stream-errors';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from '../../../stream-player';
import { DEFAULT_STREAM_PLAYER_STATE, StreamPlayerCapabilities, StreamPlayerState } from '../../../stream.types';
import { TikTokPlayerParamsDirective } from './tiktok-player-params.directive';

export const TIKTOK_PLAYER_TOKEN = new InjectionToken<TikTokPlayerDirective>('TIKTOK_PLAYER_TOKEN');

const TIKTOK_PLAYER_STATE = { INIT: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 } as const;

@Directive({
  providers: [
    { provide: TIKTOK_PLAYER_TOKEN, useExisting: TikTokPlayerDirective },
    { provide: STREAM_PLAYER_TOKEN, useExisting: TikTokPlayerDirective },
  ],
})
export class TikTokPlayerDirective implements StreamPlayer {
  private el = injectHostElement();
  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);
  private renderer = injectRenderer();
  private params = inject(TikTokPlayerParamsDirective);

  readonly CAPABILITIES: StreamPlayerCapabilities = {
    canPlay: true,
    canPause: true,
    canMute: true,
    canSeek: true,
    canGetDuration: true,
    isLiveCapable: false,
    hasThumbnail: false,
  };

  state = signal<StreamPlayerState>({ ...DEFAULT_STREAM_PLAYER_STATE });
  thumbnail = signal<string | null>(null);

  private iframe: HTMLIFrameElement | null = null;

  private playerResource = rxResource({
    params: () => (isPlatformBrowser(this.platformId) ? this.params.videoId() : null),
    stream: ({ params: videoId }) => {
      if (!videoId) return EMPTY;

      return new Observable<void>((subscriber) => {
        const iframe = this.renderer.createElement('iframe');
        const w = this.params.width();
        const h = this.params.height();

        iframe.src = `https://www.tiktok.com/player/v1/${videoId}?rel=0`;
        iframe.width = typeof w === 'number' ? String(w) : w;
        iframe.height = typeof h === 'number' ? String(h) : h;
        this.renderer.setStyle(iframe, { border: 'none' });
        iframe.scrolling = 'no';
        iframe.allowFullscreen = true;
        iframe.allow = 'accelerometer; autoplay; fullscreen; encrypted-media; gyroscope; picture-in-picture';

        this.iframe = iframe;

        const handleMessage = (event: Event) => {
          const e = event as MessageEvent;
          if (!iframe || e.source !== iframe.contentWindow) return;
          const msg = e.data as Record<string, unknown> | null;
          if (!msg?.['x-tiktok-player']) return;

          switch (msg['type']) {
            case 'onPlayerReady':
              this.state.update((s) => ({ ...s, isReady: true, isLoading: false }));
              break;
            case 'onStateChange': {
              const value = msg['value'] as number;
              this.state.update((s) => ({
                ...s,
                isPlaying: value === TIKTOK_PLAYER_STATE.PLAYING || value === TIKTOK_PLAYER_STATE.BUFFERING,
                isEnded: value === TIKTOK_PLAYER_STATE.ENDED,
              }));
              break;
            }
            case 'onCurrentTime': {
              const val = msg['value'] as { currentTime: number; duration: number };
              this.state.update((s) => ({ ...s, currentTime: val.currentTime, duration: val.duration }));
              break;
            }
            case 'onMute': {
              const muted = !!msg['value'];
              this.state.update((s) => ({ ...s, isMuted: muted }));
              break;
            }
            case 'onError': {
              const tiktokError = new RuntimeError(
                STREAM_ERROR_CODES.TIKTOK_PLAYER_ERROR,
                `[EtTikTokPlayer] TikTok player error: ${msg['value'] ?? 'unknown error'}`,
              );
              this.state.update((s) => ({ ...s, error: tiktokError, isLoading: false }));
              subscriber.error(tiktokError);
              break;
            }
          }
        };

        const unlisten = this.renderer.listen('window', 'message', handleMessage);

        iframe.onload = () => {
          this.state.update((s) => ({ ...s, isReady: true, isLoading: false }));
          subscriber.next();
        };

        this.renderer.appendChild(this.el, iframe);

        return () => {
          unlisten();
          this.iframe = null;
          if (this.el.contains(iframe)) {
            this.renderer.removeChild(this.el, iframe);
          }
          this.state.set({ ...DEFAULT_STREAM_PLAYER_STATE });
        };
      });
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
    this.post('play');
  }

  pause() {
    this.post('pause');
  }

  mute() {
    this.post('mute');
  }

  unmute() {
    this.post('unMute');
  }

  seek(seconds: number) {
    this.post('seekTo', seconds);
  }

  retry() {
    this.playerResource.reload();
  }

  private post(type: string, value?: unknown) {
    if (!this.iframe?.contentWindow) return;
    const message: Record<string, unknown> = { 'x-tiktok-player': true, type };
    if (value !== undefined) message['value'] = value;
    this.iframe.contentWindow.postMessage(message, '*');
  }
}
