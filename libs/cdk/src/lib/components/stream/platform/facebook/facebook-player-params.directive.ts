import { Directive, computed, input, inputBinding } from '@angular/core';
import { STREAM_PLAYER_PARAMS_TOKEN, StreamPlayerParams } from '../../stream-player-slot.directive';

@Directive({
  providers: [{ provide: STREAM_PLAYER_PARAMS_TOKEN, useExisting: FacebookPlayerParamsDirective }],
})
export class FacebookPlayerParamsDirective implements StreamPlayerParams {
  videoId = input.required<string>();
  width = input<string | number>('100%');
  height = input<string | number>('100%');

  playerId = computed(() => `facebook-${this.videoId()}`);

  createBindings() {
    return [
      inputBinding('videoId', () => this.videoId()),
      inputBinding('width', () => this.width()),
      inputBinding('height', () => this.height()),
    ];
  }
}
