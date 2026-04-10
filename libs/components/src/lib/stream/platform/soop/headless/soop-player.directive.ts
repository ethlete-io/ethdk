import { isPlatformBrowser } from '@angular/common';
import { Directive, InjectionToken, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { injectHostElement, injectRenderer } from '@ethlete/core';
import { EMPTY, Observable } from 'rxjs';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from '../../../stream-player';
import { DEFAULT_STREAM_PLAYER_STATE, StreamPlayerCapabilities, StreamPlayerState } from '../../../stream.types';
import { SoopPlayerParamsDirective } from './soop-player-params.directive';

export const SOOP_PLAYER_TOKEN = new InjectionToken<SoopPlayerDirective>('SOOP_PLAYER_TOKEN');

@Directive({
  providers: [
    { provide: SOOP_PLAYER_TOKEN, useExisting: SoopPlayerDirective },
    { provide: STREAM_PLAYER_TOKEN, useExisting: SoopPlayerDirective },
  ],
})
export class SoopPlayerDirective implements StreamPlayer {
  private el = injectHostElement();
  private platformId = inject(PLATFORM_ID);
  private renderer = injectRenderer();
  private params = inject(SoopPlayerParamsDirective);

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
    params: (): { userId: string | null; videoId: string | null } | null => {
      if (!isPlatformBrowser(this.platformId)) return null;
      const userId = this.params.userId();
      const videoId = this.params.videoId();
      if (!userId && !videoId) return null;
      return { userId, videoId };
    },
    stream: ({ params }) => {
      if (!params) return EMPTY;

      return new Observable<void>((subscriber) => {
        const iframe = this.renderer.createElement('iframe');
        const w = this.params.width();
        const h = this.params.height();

        if (params.userId) {
          iframe.src = `https://play.afreecatv.com/${params.userId}/embed`;
        } else {
          iframe.src = `https://vod.afreecatv.com/player/${params.videoId}`;
        }

        iframe.width = typeof w === 'number' ? String(w) : w;
        iframe.height = typeof h === 'number' ? String(h) : h;
        this.renderer.setStyle(iframe, { border: 'none' });
        iframe.scrolling = 'no';
        iframe.allowFullscreen = true;
        iframe.allow = 'autoplay; encrypted-media';

        iframe.onload = () => {
          this.state.set({ ...DEFAULT_STREAM_PLAYER_STATE, isReady: true, isLoading: false });
          subscriber.next();
        };

        this.renderer.appendChild(this.el, iframe);

        return () => {
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

  // SOOP embeds have no programmatic control API — these are intentional no-ops.

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
