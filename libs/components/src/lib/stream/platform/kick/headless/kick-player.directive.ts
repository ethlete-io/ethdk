import { isPlatformBrowser } from '@angular/common';
import { Directive, InjectionToken, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { injectHostElement } from '@ethlete/core';
import { EMPTY, Observable } from 'rxjs';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from '../../../stream-player';
import { DEFAULT_STREAM_PLAYER_STATE, StreamPlayerCapabilities, StreamPlayerState } from '../../../stream.types';
import { KickPlayerParamsDirective } from './kick-player-params.directive';

export const KICK_PLAYER_TOKEN = new InjectionToken<KickPlayerDirective>('KICK_PLAYER_TOKEN');

@Directive({
  providers: [
    { provide: KICK_PLAYER_TOKEN, useExisting: KickPlayerDirective },
    { provide: STREAM_PLAYER_TOKEN, useExisting: KickPlayerDirective },
  ],
})
export class KickPlayerDirective implements StreamPlayer {
  private el = injectHostElement();
  private platformId = inject(PLATFORM_ID);
  private params = inject(KickPlayerParamsDirective);

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
    params: () => (isPlatformBrowser(this.platformId) ? this.params.channel() : null),
    stream: ({ params: channel }) => {
      if (!channel) return EMPTY;

      return new Observable<void>((subscriber) => {
        const iframe = document.createElement('iframe');
        const qs = new URLSearchParams({ parent: window.location.hostname });
        if (this.params.muted()) qs.set('muted', 'true');

        iframe.src = `https://player.kick.com/${channel}?${qs}`;
        iframe.width = String(this.params.width());
        iframe.height = String(this.params.height());
        iframe.style.border = 'none';
        iframe.scrolling = 'no';
        iframe.allowFullscreen = true;
        iframe.allow = 'autoplay; encrypted-media';

        iframe.addEventListener('load', () => {
          this.state.set({ ...DEFAULT_STREAM_PLAYER_STATE, isReady: true, isLoading: false });
          subscriber.next();
        });

        this.el.appendChild(iframe);

        return () => {
          if (this.el.contains(iframe)) {
            this.el.removeChild(iframe);
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

  // Kick embeds have no programmatic control API — these are intentional no-ops.

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
