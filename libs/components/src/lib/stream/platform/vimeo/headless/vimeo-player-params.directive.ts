import { Directive, computed, input, inputBinding, numberAttribute } from '@angular/core';
import { STREAM_PLAYER_PARAMS_TOKEN, StreamPlayerParams } from '../../../stream-player-slot.directive';

@Directive({
  providers: [{ provide: STREAM_PLAYER_PARAMS_TOKEN, useExisting: VimeoPlayerParamsDirective }],
})
export class VimeoPlayerParamsDirective implements StreamPlayerParams {
  public videoId = input.required<string | number>();
  public startTime = input(0, { transform: numberAttribute });
  public width = input<string | number>('100%');
  public height = input<string | number>('100%');

  public playerId = computed(() => `vimeo-${this.videoId()}`);

  public createBindings() {
    return [
      inputBinding('videoId', () => this.videoId()),
      inputBinding('startTime', () => this.startTime()),
      inputBinding('width', () => this.width()),
      inputBinding('height', () => this.height()),
    ];
  }
}
