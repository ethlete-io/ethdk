import { Directive, computed, input, inputBinding, numberAttribute } from '@angular/core';
import { STREAM_PLAYER_PARAMS_TOKEN, StreamPlayerParams } from '../../../stream-player-slot.directive';
import { streamSizeAttribute } from '../../../stream-size';

@Directive({
  providers: [{ provide: STREAM_PLAYER_PARAMS_TOKEN, useExisting: DailymotionPlayerParamsDirective }],
})
export class DailymotionPlayerParamsDirective implements StreamPlayerParams {
  public videoId = input.required<string>();
  public startTime = input(0, { transform: numberAttribute });
  public width = input<string | number, string | number>('100%', { transform: streamSizeAttribute });
  public height = input<string | number, string | number>('100%', { transform: streamSizeAttribute });

  public playerId = computed(() => `dailymotion-${this.videoId()}`);

  public createBindings() {
    return [
      inputBinding('videoId', () => this.videoId()),
      inputBinding('startTime', () => this.startTime()),
      inputBinding('width', () => this.width()),
      inputBinding('height', () => this.height()),
    ];
  }
}
