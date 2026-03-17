import { isPlatformBrowser } from '@angular/common';
import { Directive, InjectionToken, PLATFORM_ID, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { injectHostElement } from '@ethlete/core';
import { EMPTY, Observable } from 'rxjs';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from '../../stream-player';
import { StreamPlayerCapabilities, StreamPlayerState } from '../../stream.types';

export const TIKTOK_PLAYER_TOKEN = new InjectionToken<TikTokPlayerDirective>('TIKTOK_PLAYER_TOKEN');

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
    { provide: TIKTOK_PLAYER_TOKEN, useExisting: TikTokPlayerDirective },
    { provide: STREAM_PLAYER_TOKEN, useExisting: TikTokPlayerDirective },
  ],
})
export class TikTokPlayerDirective implements StreamPlayer {
  private el = injectHostElement();
  private platformId = inject(PLATFORM_ID);

  readonly CAPABILITIES: StreamPlayerCapabilities = {
    canPlay: false,
    canPause: false,
    canMute: false,
    canSeek: false,
    canGetDuration: false,
    isLiveCapable: false,
  };

  state = signal<StreamPlayerState>({ ...DEFAULT_STATE });

  /** Numeric TikTok video ID from the post URL. */
  videoId = input.required<string>();
  width = input<string | number>('100%');
  height = input<string | number>('100%');

  private playerResource = rxResource({
    params: () => (isPlatformBrowser(this.platformId) ? this.videoId() : null),
    stream: ({ params: videoId }) => {
      if (!videoId) return EMPTY;

      return new Observable<void>((subscriber) => {
        const iframe = document.createElement('iframe');
        const w = this.width();
        const h = this.height();

        iframe.src = `https://www.tiktok.com/embed/v2/${videoId}`;
        iframe.width = typeof w === 'number' ? String(w) : w;
        iframe.height = typeof h === 'number' ? String(h) : h;
        iframe.style.border = 'none';
        iframe.scrolling = 'no';
        iframe.allowFullscreen = true;
        iframe.allow = 'autoplay; encrypted-media';

        iframe.addEventListener('load', () => {
          this.state.set({ ...DEFAULT_STATE, isReady: true });
          subscriber.next();
        });

        this.el.appendChild(iframe);

        return () => {
          if (this.el.contains(iframe)) {
            this.el.removeChild(iframe);
          }
          this.state.set({ ...DEFAULT_STATE });
        };
      });
    },
  });

  readonly error = computed(() => (this.playerResource.isLoading() ? undefined : this.playerResource.error()));

  // TikTok embeds have no programmatic control API — these are intentional no-ops.

  play(): void {
    // no-op
  }
  pause(): void {
    // no-op
  }
  mute(): void {
    // no-op
  }
  unmute(): void {
    // no-op
  }
  seek(): void {
    // no-op
  }

  retry(): void {
    this.playerResource.reload();
  }
}
