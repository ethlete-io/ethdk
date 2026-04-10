import { isPlatformBrowser } from '@angular/common';
import { Directive, InjectionToken, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { injectHostElement, injectRenderer } from '@ethlete/core';
import { EMPTY, Observable } from 'rxjs';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from '../../../stream-player';
import { DEFAULT_STREAM_PLAYER_STATE, StreamPlayerCapabilities, StreamPlayerState } from '../../../stream.types';
import { DailymotionPlayerParamsDirective } from './dailymotion-player-params.directive';

export const DAILYMOTION_PLAYER_TOKEN = new InjectionToken<DailymotionPlayerDirective>('DAILYMOTION_PLAYER_TOKEN');

@Directive({
  providers: [
    { provide: DAILYMOTION_PLAYER_TOKEN, useExisting: DailymotionPlayerDirective },
    { provide: STREAM_PLAYER_TOKEN, useExisting: DailymotionPlayerDirective },
  ],
})
export class DailymotionPlayerDirective implements StreamPlayer {
  private el = injectHostElement();
  private platformId = inject(PLATFORM_ID);
  private renderer = injectRenderer();
  private params = inject(DailymotionPlayerParamsDirective);

  readonly CAPABILITIES: StreamPlayerCapabilities = {
    canPlay: false,
    canPause: false,
    canMute: false,
    canSeek: false,
    canGetDuration: false,
    isLiveCapable: true,
    hasThumbnail: false,
  };

  state = signal<StreamPlayerState>({ ...DEFAULT_STREAM_PLAYER_STATE });
  thumbnail = signal<string | null>(null);

  private playerResource = rxResource({
    params: () => (isPlatformBrowser(this.platformId) ? this.params.videoId() : null),
    stream: ({ params: videoId }) => {
      if (!videoId) return EMPTY;

      return new Observable<void>((subscriber) => {
        const iframe = this.renderer.createElement('iframe');
        const qs = new URLSearchParams({ autoplay: '0' });
        const startTime = this.params.startTime();
        if (startTime > 0) qs.set('start', String(startTime));

        const w = this.params.width();
        const h = this.params.height();
        iframe.src = `https://www.dailymotion.com/embed/video/${videoId}?${qs}`;
        iframe.width = typeof w === 'number' ? String(w) : w;
        iframe.height = typeof h === 'number' ? String(h) : h;
        this.renderer.setStyle(iframe, { border: 'none' });
        iframe.allow = 'autoplay; encrypted-media';
        iframe.allowFullscreen = true;
        iframe.scrolling = 'no';

        iframe.onload = () => {
          this.state.set({ ...DEFAULT_STREAM_PLAYER_STATE, isReady: true, isLoading: false });
          subscriber.next();
        };

        this.renderer.appendChild(this.el, iframe);

        return () => {
          if (this.el.contains(iframe)) this.renderer.removeChild(this.el, iframe);
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

  // Dailymotion embeds have no programmatic control API without a dashboard-created player ID

  play() {
    // no-op
  }

  pause() {
    // no-op
  }

  mute() {
    // no-op
  }

  unmute() {
    // no-op
  }

  seek() {
    // no-op
  }

  retry() {
    this.playerResource.reload();
  }
}
