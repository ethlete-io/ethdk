import { Directive, booleanAttribute, computed, input, inputBinding, numberAttribute } from '@angular/core';
import { STREAM_PLAYER_PARAMS_TOKEN, StreamPlayerParams } from '../../../stream-player-slot.directive';
import { streamSizeAttribute } from '../../../stream-size';
import { YtPlayerVars } from './youtube-player.types';

const DEFAULT_YOUTUBE_HOST = 'www.youtube.com';

@Directive({
  providers: [{ provide: STREAM_PLAYER_PARAMS_TOKEN, useExisting: YoutubePlayerParamsDirective }],
})
export class YoutubePlayerParamsDirective implements StreamPlayerParams {
  public videoId = input.required<string>();
  public startTime = input(0, { transform: numberAttribute });
  public width = input<string | number, string | number>('100%', { transform: streamSizeAttribute });
  public height = input<string | number, string | number>('100%', { transform: streamSizeAttribute });

  /** Starts the video once the player is ready. Playback starts muted, as browsers block autoplay with sound. */
  public autoplay = input(false, { transform: booleanAttribute });

  /** The host that serves the embed, e.g. `www.youtube-nocookie.com`. A scheme and a trailing slash are optional. */
  public host = input(DEFAULT_YOUTUBE_HOST);

  /** Player vars merged over the SDK defaults, e.g. `{ controls: 0 }`. The given keys win; every other key keeps its default. */
  public playerVars = input<YtPlayerVars>({});

  public hostUrl = computed(() => {
    const host = this.host().trim().replace(/\/+$/, '') || DEFAULT_YOUTUBE_HOST;

    return /^https?:\/\//i.test(host) ? host : `https://${host}`;
  });

  public playerId = computed(() => `youtube-${this.videoId()}`);

  public createBindings() {
    return [
      inputBinding('videoId', () => this.videoId()),
      inputBinding('startTime', () => this.startTime()),
      inputBinding('width', () => this.width()),
      inputBinding('height', () => this.height()),
      inputBinding('autoplay', () => this.autoplay()),
      inputBinding('host', () => this.host()),
      inputBinding('playerVars', () => this.playerVars()),
    ];
  }
}
