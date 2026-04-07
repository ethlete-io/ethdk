import { Directive, booleanAttribute, computed, input, inputBinding } from '@angular/core';
import { STREAM_PLAYER_PARAMS_TOKEN, StreamPlayerParams } from '../../stream-player-slot.directive';

@Directive({
  providers: [{ provide: STREAM_PLAYER_PARAMS_TOKEN, useExisting: KickPlayerParamsDirective }],
})
export class KickPlayerParamsDirective implements StreamPlayerParams {
  channel = input.required<string>();
  width = input<string | number>('100%');
  height = input<string | number>('100%');
  muted = input(false, { transform: booleanAttribute });

  playerId = computed(() => `kick-${this.channel()}`);

  createBindings() {
    return [
      inputBinding('channel', () => this.channel()),
      inputBinding('width', () => this.width()),
      inputBinding('height', () => this.height()),
      inputBinding('muted', () => this.muted()),
    ];
  }
}
