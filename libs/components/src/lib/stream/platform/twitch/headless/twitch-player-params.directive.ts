import { Directive, booleanAttribute, computed, input, inputBinding, numberAttribute } from '@angular/core';
import { STREAM_PLAYER_PARAMS_TOKEN, StreamPlayerParams } from '../../../stream-player-slot.directive';

// Matches Twitch VOD URLs: twitch.tv/videos/123 or twitch.tv/video/123
const MATCH_VIDEO = /(?:www\.|go\.)?twitch\.tv\/(?:videos?\/)([\d]+)/;
// Matches Twitch channel URLs: twitch.tv/channelname
const MATCH_CHANNEL = /(?:www\.|go\.)?twitch\.tv\/([a-zA-Z0-9_]+)/;

@Directive({
  providers: [{ provide: STREAM_PLAYER_PARAMS_TOKEN, useExisting: TwitchPlayerParamsDirective }],
})
export class TwitchPlayerParamsDirective implements StreamPlayerParams {
  public src = input.required<string>();
  public width = input<string | number>('100%');
  public height = input<string | number>('100%');
  public autoplay = input(false, { transform: booleanAttribute });
  public chat = input(false, { transform: booleanAttribute });
  public startTime = input(0, { transform: numberAttribute });

  public channel = computed(() => {
    const s = this.src();
    if (MATCH_VIDEO.test(s)) return null;
    const m = s.match(MATCH_CHANNEL);
    if (m) return m[1] ?? null;
    return /^\d+$/.test(s) ? null : s;
  });

  public video = computed(() => {
    const s = this.src();
    const m = s.match(MATCH_VIDEO);
    if (m) return m[1] ?? null;
    if (MATCH_CHANNEL.test(s)) return null;
    return /^\d+$/.test(s) ? s : null;
  });

  public playerId = computed(() => {
    const c = this.channel();
    return c ? `twitch-channel-${c}` : `twitch-video-${this.video()}`;
  });

  public createBindings() {
    return [
      inputBinding('src', () => this.src()),
      inputBinding('width', () => this.width()),
      inputBinding('height', () => this.height()),
      inputBinding('autoplay', () => this.autoplay()),
      inputBinding('chat', () => this.chat()),
      inputBinding('startTime', () => this.startTime()),
    ];
  }
}
