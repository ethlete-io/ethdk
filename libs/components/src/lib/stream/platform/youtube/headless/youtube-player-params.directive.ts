import { Directive, computed, input, inputBinding, numberAttribute } from '@angular/core';
import { STREAM_PLAYER_PARAMS_TOKEN, StreamPlayerParams } from '../../../stream-player-slot.directive';

@Directive({
  providers: [{ provide: STREAM_PLAYER_PARAMS_TOKEN, useExisting: YoutubePlayerParamsDirective }],
})
export class YoutubePlayerParamsDirective implements StreamPlayerParams {
  public videoId = input.required<string>();
  public startTime = input(0, { transform: numberAttribute });
  public width = input<string | number>('100%');
  public height = input<string | number>('100%');

  public playerId = computed(() => `youtube-${this.videoId()}`);

  public createBindings() {
    return [
      inputBinding('videoId', () => this.videoId()),
      inputBinding('startTime', () => this.startTime()),
      inputBinding('width', () => this.width()),
      inputBinding('height', () => this.height()),
    ];
  }
}
