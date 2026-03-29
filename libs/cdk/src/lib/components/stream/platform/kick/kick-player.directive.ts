import { isPlatformBrowser } from '@angular/common';
import {
  Directive,
  InjectionToken,
  PLATFORM_ID,
  booleanAttribute,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { injectHostElement } from '@ethlete/core';
import { EMPTY, Observable } from 'rxjs';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from '../../stream-player';
import { StreamPlayerCapabilities, StreamPlayerState } from '../../stream.types';

export const KICK_PLAYER_TOKEN = new InjectionToken<KickPlayerDirective>('KICK_PLAYER_TOKEN');

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
    { provide: KICK_PLAYER_TOKEN, useExisting: KickPlayerDirective },
    { provide: STREAM_PLAYER_TOKEN, useExisting: KickPlayerDirective },
  ],
})
export class KickPlayerDirective implements StreamPlayer {
  private el = injectHostElement();
  private platformId = inject(PLATFORM_ID);

  readonly CAPABILITIES: StreamPlayerCapabilities = {
    canPlay: false,
    canPause: false,
    canMute: false,
    canSeek: false,
    canGetDuration: false,
    isLiveCapable: true,
    hasThumbnail: false,
  };

  state = signal<StreamPlayerState>({ ...DEFAULT_STATE });
  thumbnail = signal<string | null>(null);

  channel = input.required<string>();
  width = input<string | number>('100%');
  height = input<string | number>('100%');
  muted = input(false, { transform: booleanAttribute });

  private playerResource = rxResource({
    params: () => (isPlatformBrowser(this.platformId) ? this.channel() : null),
    stream: ({ params: channel }) => {
      if (!channel) return EMPTY;

      return new Observable<void>((subscriber) => {
        const iframe = document.createElement('iframe');
        const qs = new URLSearchParams({ parent: window.location.hostname });
        if (this.muted()) qs.set('muted', 'true');

        iframe.src = `https://player.kick.com/${channel}?${qs}`;
        iframe.width = String(this.width());
        iframe.height = String(this.height());
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

  error = computed(() => (this.playerResource.isLoading() ? undefined : this.playerResource.error()));

  // Kick embeds have no programmatic control API — these are intentional no-ops.

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
