import { Directive, computed, input, inputBinding } from '@angular/core';
import { STREAM_PLAYER_PARAMS_TOKEN, StreamPlayerParams } from '../../stream-player-slot.directive';

@Directive({
  providers: [{ provide: STREAM_PLAYER_PARAMS_TOKEN, useExisting: TikTokPlayerParamsDirective }],
})
export class TikTokPlayerParamsDirective implements StreamPlayerParams {
  videoId = input.required<string>();
  width = input<string | number>('100%');
  height = input<string | number>('100%');

  readonly ASPECT_RATIO = 9 / 16;

  playerId = computed(() => `tiktok-${this.videoId()}`);

  createBindings() {
    return [
      inputBinding('videoId', () => this.videoId()),
      inputBinding('width', () => this.width()),
      inputBinding('height', () => this.height()),
    ];
  }
}
