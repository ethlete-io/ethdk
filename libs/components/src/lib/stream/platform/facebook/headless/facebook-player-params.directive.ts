import { Directive, computed, input, inputBinding } from '@angular/core';
import { STREAM_PLAYER_PARAMS_TOKEN, StreamPlayerParams } from '../../../stream-player-slot.directive';
import { streamSizeAttribute } from '../../../stream-size';

@Directive({
  providers: [{ provide: STREAM_PLAYER_PARAMS_TOKEN, useExisting: FacebookPlayerParamsDirective }],
})
export class FacebookPlayerParamsDirective implements StreamPlayerParams {
  public videoId = input.required<string>();
  public width = input<string | number, string | number>('100%', { transform: streamSizeAttribute });
  public height = input<string | number, string | number>('100%', { transform: streamSizeAttribute });

  public playerId = computed(() => `facebook-${this.videoId()}`);

  public createBindings() {
    return [
      inputBinding('videoId', () => this.videoId()),
      inputBinding('width', () => this.width()),
      inputBinding('height', () => this.height()),
    ];
  }
}
