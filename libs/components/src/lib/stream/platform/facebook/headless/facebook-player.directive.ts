import { isPlatformBrowser } from '@angular/common';
import { Directive, InjectionToken, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { injectHostElement } from '@ethlete/core';
import { EMPTY, Observable } from 'rxjs';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from '../../../stream-player';
import { injectStreamScriptLoader } from '../../../stream-script-loader';
import { DEFAULT_STREAM_PLAYER_STATE, StreamPlayerCapabilities, StreamPlayerState } from '../../../stream.types';
import { FacebookPlayerParamsDirective } from './facebook-player-params.directive';
import { FacebookVideoPlayer, FacebookWindow } from './facebook-player.types';

const FB_SDK_URL = 'https://connect.facebook.net/de_DE/sdk.js#xfbml=1&version=v3.2';

export const FACEBOOK_PLAYER_TOKEN = new InjectionToken<FacebookPlayerDirective>('FACEBOOK_PLAYER_TOKEN');

@Directive({
  providers: [
    { provide: FACEBOOK_PLAYER_TOKEN, useExisting: FacebookPlayerDirective },
    { provide: STREAM_PLAYER_TOKEN, useExisting: FacebookPlayerDirective },
  ],
})
export class FacebookPlayerDirective implements StreamPlayer {
  private el = injectHostElement();
  private scriptLoader = injectStreamScriptLoader();
  private platformId = inject(PLATFORM_ID);
  private params = inject(FacebookPlayerParamsDirective);

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

  private playerResource = rxResource({
    params: () => (isPlatformBrowser(this.platformId) ? this.params.videoId() : null),
    stream: ({ params: videoId }) => {
      if (!videoId) return EMPTY;

      const videoUrl = `https://www.facebook.com/video/${videoId}`;

      return new Observable<FacebookVideoPlayer>((subscriber) => {
        const win = window as unknown as FacebookWindow;
        const playerSubscriptions: Array<{ release(): void }> = [];
        let active = true;
        let loaderSub: { unsubscribe(): void } | null = null;
        let xfbmlReadyHandler: ((msg: unknown) => void) | null = null;

        const createEmbed = () => {
          if (!active) return;
          const containerId = `et-fb-${Math.random().toString(36).slice(2)}`;

          xfbmlReadyHandler = (rawMsg: unknown) => {
            const msg = rawMsg as { type: string; id: string; instance: unknown };
            if (msg.type !== 'video' || msg.id !== containerId) return;
            const player = msg.instance as FacebookVideoPlayer;

            this.state.update((s) => ({ ...s, isReady: true, isLoading: false }));
            subscriber.next(player);

            playerSubscriptions.push(
              player.subscribe('startedPlaying', () => {
                this.state.update((s) => ({ ...s, isPlaying: true, isEnded: false }));
              }),
            );
            playerSubscriptions.push(
              player.subscribe('paused', () => {
                this.state.update((s) => ({ ...s, isPlaying: false }));
              }),
            );
            playerSubscriptions.push(
              player.subscribe('finishedPlaying', () => {
                this.state.update((s) => ({ ...s, isPlaying: false, isEnded: true }));
              }),
            );
          };

          win.FB.Event.subscribe('xfbml.ready', xfbmlReadyHandler);

          const w = this.params.width();
          const h = this.params.height();
          const container = document.createElement('div');
          container.id = containerId;
          container.className = 'fb-video';
          container.dataset['href'] = videoUrl;
          container.dataset['width'] = typeof w === 'number' ? String(w) : 'auto';
          container.dataset['showText'] = 'false';

          this.el.style.display = 'block';
          this.el.style.width = typeof w === 'number' ? `${w}px` : w;
          if (typeof h === 'number') this.el.style.height = `${h}px`;

          this.el.appendChild(container);
          win.FB.XFBML.parse(this.el);
        };

        if (win.FB) {
          createEmbed();
        } else {
          const prev = win.fbAsyncInit;
          win.fbAsyncInit = () => {
            prev?.();
            createEmbed();
          };
          loaderSub = this.scriptLoader.load(FB_SDK_URL).subscribe({
            error: (e: unknown) => subscriber.error(e),
          });
        }

        return () => {
          active = false;
          loaderSub?.unsubscribe();
          if (xfbmlReadyHandler) win.FB?.Event.unsubscribe('xfbml.ready', xfbmlReadyHandler);
          for (const sub of playerSubscriptions) sub.release();
          this.el.innerHTML = '';
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
    this.playerResource.value()?.play();
  }

  pause() {
    this.playerResource.value()?.pause();
  }

  mute() {
    this.playerResource.value()?.mute();
    this.state.update((s) => ({ ...s, isMuted: true }));
  }

  unmute() {
    this.playerResource.value()?.unmute();
    this.state.update((s) => ({ ...s, isMuted: false }));
  }

  seek(seconds: number) {
    this.playerResource.value()?.seek(seconds);
  }

  retry() {
    this.playerResource.reload();
  }
}
