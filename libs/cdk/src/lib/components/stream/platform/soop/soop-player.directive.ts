import { isPlatformBrowser } from '@angular/common';
import { Directive, InjectionToken, PLATFORM_ID, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { injectHostElement } from '@ethlete/core';
import { EMPTY, Observable } from 'rxjs';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from '../../stream-player';
import { StreamPlayerCapabilities, StreamPlayerState } from '../../stream.types';

export const SOOP_PLAYER_TOKEN = new InjectionToken<SoopPlayerDirective>('SOOP_PLAYER_TOKEN');

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
    { provide: SOOP_PLAYER_TOKEN, useExisting: SoopPlayerDirective },
    { provide: STREAM_PLAYER_TOKEN, useExisting: SoopPlayerDirective },
  ],
})
export class SoopPlayerDirective implements StreamPlayer {
  private el = injectHostElement();
  private platformId = inject(PLATFORM_ID);

  readonly CAPABILITIES: StreamPlayerCapabilities = {
    canPlay: false,
    canPause: false,
    canMute: false,
    canSeek: false,
    canGetDuration: false,
    isLiveCapable: true,
  };

  state = signal<StreamPlayerState>({ ...DEFAULT_STATE });

  /** Streamer user ID — used for live streams (play.afreecatv.com/{userId}/embed). */
  userId = input<string | null>(null);
  /** VOD number — used for recorded broadcasts (vod.afreecatv.com/player/{videoId}). */
  videoId = input<string | null>(null);
  width = input<string | number>('100%');
  height = input<string | number>('100%');

  private playerResource = rxResource({
    params: (): { userId: string | null; videoId: string | null } | null => {
      if (!isPlatformBrowser(this.platformId)) return null;
      const userId = this.userId();
      const videoId = this.videoId();
      if (!userId && !videoId) return null;
      return { userId, videoId };
    },
    stream: ({ params }) => {
      if (!params) return EMPTY;

      return new Observable<void>((subscriber) => {
        const iframe = document.createElement('iframe');
        const w = this.width();
        const h = this.height();

        if (params.userId) {
          iframe.src = `https://play.afreecatv.com/${params.userId}/embed`;
        } else {
          iframe.src = `https://vod.afreecatv.com/player/${params.videoId}`;
        }

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

  // SOOP embeds have no programmatic control API — these are intentional no-ops.

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
