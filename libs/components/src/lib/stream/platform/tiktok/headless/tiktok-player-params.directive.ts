import { Directive, computed, input, inputBinding } from '@angular/core';
import { STREAM_PLAYER_PARAMS_TOKEN, StreamPlayerParams } from '../../../stream-player-slot.directive';

@Directive({
  providers: [{ provide: STREAM_PLAYER_PARAMS_TOKEN, useExisting: TikTokPlayerParamsDirective }],
})
export class TikTokPlayerParamsDirective implements StreamPlayerParams {
  public videoId = input.required<string>();
  public width = input<string | number>('100%');
  public height = input<string | number>('100%');

  public readonly ASPECT_RATIO = 9 / 16;

  public playerId = computed(() => `tiktok-${this.videoId()}`);

  public createBindings() {
    return [
      inputBinding('videoId', () => this.videoId()),
      inputBinding('width', () => this.width()),
      inputBinding('height', () => this.height()),
    ];
  }
}
