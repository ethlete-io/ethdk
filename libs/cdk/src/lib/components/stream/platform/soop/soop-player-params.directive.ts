import { Directive, computed, input, inputBinding } from '@angular/core';
import { STREAM_PLAYER_PARAMS_TOKEN, StreamPlayerParams } from '../../stream-player-slot.directive';

@Directive({
  providers: [{ provide: STREAM_PLAYER_PARAMS_TOKEN, useExisting: SoopPlayerParamsDirective }],
})
export class SoopPlayerParamsDirective implements StreamPlayerParams {
  userId = input<string | null>(null);
  videoId = input<string | null>(null);
  width = input<string | number>('100%');
  height = input<string | number>('100%');

  playerId = computed(() => {
    const u = this.userId();
    return u ? `soop-user-${u}` : `soop-video-${this.videoId()}`;
  });

  createBindings() {
    return [
      inputBinding('userId', () => this.userId()),
      inputBinding('videoId', () => this.videoId()),
      inputBinding('width', () => this.width()),
      inputBinding('height', () => this.height()),
    ];
  }
}
