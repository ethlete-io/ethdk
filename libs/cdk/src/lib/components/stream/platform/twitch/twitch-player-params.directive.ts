import { Directive, booleanAttribute, computed, input, inputBinding, numberAttribute } from '@angular/core';
import { STREAM_PLAYER_PARAMS_TOKEN, StreamPlayerParams } from '../../stream-player-slot.directive';

@Directive({
  providers: [{ provide: STREAM_PLAYER_PARAMS_TOKEN, useExisting: TwitchPlayerParamsDirective }],
})
export class TwitchPlayerParamsDirective implements StreamPlayerParams {
  channel = input<string | null>(null);
  video = input<string | null>(null);
  width = input<string | number>('100%');
  height = input<string | number>('100%');
  autoplay = input(false, { transform: booleanAttribute });
  chat = input(false, { transform: booleanAttribute });
  startTime = input(0, { transform: numberAttribute });

  playerId = computed(() => {
    const c = this.channel();
    return c ? `twitch-channel-${c}` : `twitch-video-${this.video()}`;
  });

  createBindings() {
    return [
      inputBinding('channel', () => this.channel()),
      inputBinding('video', () => this.video()),
      inputBinding('width', () => this.width()),
      inputBinding('height', () => this.height()),
      inputBinding('autoplay', () => this.autoplay()),
      inputBinding('chat', () => this.chat()),
      inputBinding('startTime', () => this.startTime()),
    ];
  }
}
