import { isPlatformBrowser } from '@angular/common';
import { Directive, InjectionToken, PLATFORM_ID, effect, inject, isDevMode, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { injectHostElement } from '@ethlete/core';
import { EMPTY, Observable, switchMap } from 'rxjs';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from '../../stream-player';
import { injectStreamScriptLoader } from '../../stream-script-loader';
import { DEFAULT_STREAM_PLAYER_STATE, StreamPlayerCapabilities, StreamPlayerState } from '../../stream.types';
import { TwitchPlayerParamsDirective } from './twitch-player-params.directive';
import { TwitchEmbedPlayer, TwitchPlayerParams, TwitchWindow } from './twitch-player.types';

const TWITCH_EMBED_URL = 'https://embed.twitch.tv/embed/v1.js';

export const TWITCH_PLAYER_TOKEN = new InjectionToken<TwitchPlayerDirective>('TWITCH_PLAYER_TOKEN');

@Directive({
  providers: [
    { provide: TWITCH_PLAYER_TOKEN, useExisting: TwitchPlayerDirective },
    { provide: STREAM_PLAYER_TOKEN, useExisting: TwitchPlayerDirective },
  ],
})
export class TwitchPlayerDirective implements StreamPlayer {
  private el = injectHostElement();
  private scriptLoader = injectStreamScriptLoader();
  private platformId = inject(PLATFORM_ID);
  private params = inject(TwitchPlayerParamsDirective);

  readonly CAPABILITIES: StreamPlayerCapabilities = {
    canPlay: true,
    canPause: true,
    canMute: true,
    canSeek: true,
    canGetDuration: true,
    isLiveCapable: true,
    hasThumbnail: false,
  };

  state = signal<StreamPlayerState>({ ...DEFAULT_STREAM_PLAYER_STATE });
  thumbnail = signal<string | null>(null);

  private playerResource = rxResource({
    params: (): TwitchPlayerParams | null => {
      if (!isPlatformBrowser(this.platformId)) return null;
      const channel = this.params.channel();
      const video = this.params.video();
      if (!channel && !video) {
        if (isDevMode()) console.warn('[et-twitch-player] Either `channel` or `video` input is required.');
        return null;
      }
      return { channel, video };
    },
    stream: ({ params }) => {
      if (!params) return EMPTY;

      return this.scriptLoader.load(TWITCH_EMBED_URL).pipe(
        switchMap(
          () =>
            new Observable<TwitchEmbedPlayer>((subscriber) => {
              const win = window as unknown as TwitchWindow;
              const TwitchEmbed = win.Twitch?.Embed;

              if (!TwitchEmbed) {
                if (isDevMode()) console.error('[et-twitch-player] Twitch Embed SDK not available after script load.');
                subscriber.error(new Error('Twitch Embed SDK not available'));
                return;
              }

              let active = true;

              const startSeconds = this.params.startTime();

              const embed = new TwitchEmbed(this.el, {
                width: this.params.width(),
                height: this.params.height(),
                parent: [window.location.hostname],
                autoplay: this.params.autoplay(),
                layout: this.params.chat() ? 'video-with-chat' : 'video',
                ...(params.channel ? { channel: params.channel } : {}),
                ...(params.video ? { video: params.video } : {}),
                ...(startSeconds ? { time: secondsToTimestamp(startSeconds) } : {}),
              });

              embed.addEventListener(TwitchEmbed.READY, () => {
                if (!active) return;
                const player = embed.getPlayer();
                this.state.set({ ...DEFAULT_STREAM_PLAYER_STATE, isReady: true, isLoading: false });
                subscriber.next(player);
              });

              embed.addEventListener(TwitchEmbed.PLAY, () => {
                if (!active) return;
                const player = embed.getPlayer();
                this.state.update((s) => ({
                  ...s,
                  isPlaying: true,
                  isEnded: false,
                  duration: player.getDuration(),
                  currentTime: player.getCurrentTime(),
                }));
              });

              embed.addEventListener(TwitchEmbed.PAUSE, () => {
                if (!active) return;
                this.state.update((s) => ({ ...s, isPlaying: false }));
              });

              embed.addEventListener(TwitchEmbed.ENDED, () => {
                if (!active) return;
                this.state.update((s) => ({ ...s, isPlaying: false, isEnded: true }));
              });

              return () => {
                active = false;
                this.el.innerHTML = '';
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

  play(): void {
    this.playerResource.value()?.play();
  }

  pause(): void {
    this.playerResource.value()?.pause();
  }

  mute(): void {
    this.playerResource.value()?.setMuted(true);
    this.state.update((s) => ({ ...s, isMuted: true }));
  }

  unmute(): void {
    this.playerResource.value()?.setMuted(false);
    this.state.update((s) => ({ ...s, isMuted: false }));
  }

  seek(seconds: number): void {
    this.playerResource.value()?.seek(seconds);
  }

  retry(): void {
    this.playerResource.reload();
  }
}

const secondsToTimestamp = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h${m}m${s}s`;
};
