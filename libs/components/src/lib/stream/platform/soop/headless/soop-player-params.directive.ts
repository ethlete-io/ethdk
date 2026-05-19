import { Directive, computed, input, inputBinding } from '@angular/core';
import { STREAM_PLAYER_PARAMS_TOKEN, StreamPlayerParams } from '../../../stream-player-slot.directive';

@Directive({
  providers: [{ provide: STREAM_PLAYER_PARAMS_TOKEN, useExisting: SoopPlayerParamsDirective }],
})
export class SoopPlayerParamsDirective implements StreamPlayerParams {
  public userId = input<string | null>(null);
  public videoId = input<string | null>(null);
  public width = input<string | number>('100%');
  public height = input<string | number>('100%');

  public playerId = computed(() => {
    const u = this.userId();
    return u ? `soop-user-${u}` : `soop-video-${this.videoId()}`;
  });

  public createBindings() {
    return [
      inputBinding('userId', () => this.userId()),
      inputBinding('videoId', () => this.videoId()),
      inputBinding('width', () => this.width()),
      inputBinding('height', () => this.height()),
    ];
  }
}
