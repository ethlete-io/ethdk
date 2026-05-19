import { Directive, booleanAttribute, computed, input, inputBinding } from '@angular/core';
import { STREAM_PLAYER_PARAMS_TOKEN, StreamPlayerParams } from '../../../stream-player-slot.directive';

@Directive({
  providers: [{ provide: STREAM_PLAYER_PARAMS_TOKEN, useExisting: KickPlayerParamsDirective }],
})
export class KickPlayerParamsDirective implements StreamPlayerParams {
  public channel = input.required<string>();
  public width = input<string | number>('100%');
  public height = input<string | number>('100%');
  public muted = input(false, { transform: booleanAttribute });

  public playerId = computed(() => `kick-${this.channel()}`);

  public createBindings() {
    return [
      inputBinding('channel', () => this.channel()),
      inputBinding('width', () => this.width()),
      inputBinding('height', () => this.height()),
      inputBinding('muted', () => this.muted()),
    ];
  }
}
