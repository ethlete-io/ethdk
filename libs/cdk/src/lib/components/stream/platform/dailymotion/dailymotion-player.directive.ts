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
import { EMPTY, Observable } from 'rxjs';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from '../../stream-player';
import { StreamPlayerCapabilities, StreamPlayerState } from '../../stream.types';

export const DAILYMOTION_PLAYER_TOKEN = new InjectionToken<DailymotionPlayerDirective>('DAILYMOTION_PLAYER_TOKEN');

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
    { provide: DAILYMOTION_PLAYER_TOKEN, useExisting: DailymotionPlayerDirective },
    { provide: STREAM_PLAYER_TOKEN, useExisting: DailymotionPlayerDirective },
  ],
})
export class DailymotionPlayerDirective implements StreamPlayer {
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

  videoId = input.required<string>();
  startTime = input(0, { transform: numberAttribute });
  width = input<string | number>('100%');
  height = input<string | number>('100%');

  private playerResource = rxResource({
    params: () => (isPlatformBrowser(this.platformId) ? this.videoId() : null),
    stream: ({ params: videoId }) => {
      if (!videoId) return EMPTY;

      return new Observable<void>((subscriber) => {
        const iframe = document.createElement('iframe');
        const qs = new URLSearchParams({ autoplay: '0' });
        const startTime = this.startTime();
        if (startTime > 0) qs.set('start', String(startTime));

        const w = this.width();
        const h = this.height();
        iframe.src = `https://www.dailymotion.com/embed/video/${videoId}?${qs}`;
        iframe.width = typeof w === 'number' ? String(w) : w;
        iframe.height = typeof h === 'number' ? String(h) : h;
        iframe.style.border = 'none';
        iframe.allow = 'autoplay; encrypted-media';
        iframe.allowFullscreen = true;
        iframe.scrolling = 'no';

        iframe.addEventListener('load', () => {
          this.state.set({ ...DEFAULT_STATE, isReady: true });
          subscriber.next();
        });

        this.el.appendChild(iframe);

        return () => {
          if (this.el.contains(iframe)) this.el.removeChild(iframe);
          this.state.set({ ...DEFAULT_STATE });
        };
      });
    },
  });

  readonly error = computed(() => (this.playerResource.isLoading() ? undefined : this.playerResource.error()));

  // Dailymotion embeds have no programmatic control API without a dashboard-created player ID

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
