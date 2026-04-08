import { isPlatformBrowser } from '@angular/common';
import { Directive, InjectionToken, PLATFORM_ID, effect, inject, isDevMode, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { injectHostElement } from '@ethlete/core';
import { EMPTY, Observable, switchMap } from 'rxjs';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from '../../../stream-player';
import { injectStreamScriptLoader } from '../../../stream-script-loader';
import { DEFAULT_STREAM_PLAYER_STATE, StreamPlayerCapabilities, StreamPlayerState } from '../../../stream.types';
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
              let twitchPlayer: TwitchEmbedPlayer | null = null;
              let currentTimeInterval: ReturnType<typeof setInterval> | null = null;

              const clearCurrentTimeInterval = () => {
                if (currentTimeInterval !== null) {
                  clearInterval(currentTimeInterval);
                  currentTimeInterval = null;
                }
              };

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
                twitchPlayer = embed.getPlayer();
                const duration = twitchPlayer.getDuration();
                this.state.set({
                  ...DEFAULT_STREAM_PLAYER_STATE,
                  isReady: true,
                  isLoading: false,
                  isMuted: twitchPlayer.getMuted(),
                  duration: duration > 0 ? duration : null,
                });
                subscriber.next(twitchPlayer);
              });

              embed.addEventListener(TwitchEmbed.PLAY, () => {
                if (!active || !twitchPlayer) return;
                clearCurrentTimeInterval();
                const player = twitchPlayer;
                currentTimeInterval = setInterval(() => {
                  this.state.update((s) => ({ ...s, currentTime: player.getCurrentTime() }));
                }, 250);
                const duration = player.getDuration();
                this.state.update((s) => ({
                  ...s,
                  isPlaying: true,
                  isEnded: false,
                  duration: duration > 0 ? duration : s.duration,
                  currentTime: player.getCurrentTime(),
                }));
              });

              embed.addEventListener(TwitchEmbed.PAUSE, () => {
                if (!active) return;
                clearCurrentTimeInterval();
                this.state.update((s) => ({ ...s, isPlaying: false }));
              });

              embed.addEventListener(TwitchEmbed.ENDED, () => {
                if (!active) return;
                clearCurrentTimeInterval();
                this.state.update((s) => ({ ...s, isPlaying: false, isEnded: true }));
              });

              return () => {
                active = false;
                clearCurrentTimeInterval();
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

  play() {
    this.playerResource.value()?.play();
  }

  pause() {
    this.playerResource.value()?.pause();
  }

  mute() {
    this.playerResource.value()?.setMuted(true);
    this.state.update((s) => ({ ...s, isMuted: true }));
  }

  unmute() {
    this.playerResource.value()?.setMuted(false);
    this.state.update((s) => ({ ...s, isMuted: false }));
  }

  seek(seconds: number) {
    this.playerResource.value()?.seek(seconds);
  }

  retry() {
    this.playerResource.reload();
  }
}

const secondsToTimestamp = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h${m}m${s}s`;
};
