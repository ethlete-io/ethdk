import { Directive, computed, input, inputBinding, numberAttribute } from '@angular/core';
import { STREAM_PLAYER_PARAMS_TOKEN, StreamPlayerParams } from '../../stream-player-slot.directive';

@Directive({
  providers: [{ provide: STREAM_PLAYER_PARAMS_TOKEN, useExisting: VimeoPlayerParamsDirective }],
})
export class VimeoPlayerParamsDirective implements StreamPlayerParams {
  videoId = input.required<string | number>();
  startTime = input(0, { transform: numberAttribute });
  width = input<string | number>('100%');
  height = input<string | number>('100%');

  playerId = computed(() => `vimeo-${this.videoId()}`);

  createBindings() {
    return [
      inputBinding('videoId', () => this.videoId()),
      inputBinding('startTime', () => this.startTime()),
      inputBinding('width', () => this.width()),
      inputBinding('height', () => this.height()),
    ];
  }
}
