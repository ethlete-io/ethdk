import { Directive, computed, input, inputBinding } from '@angular/core';
import { randomId } from '@ethlete/core';
import { STREAM_PLAYER_PARAMS_TOKEN, StreamPlayerParams } from '../../../stream-player-slot.directive';
import { streamSizeAttribute } from '../../../stream-size';

@Directive({
  providers: [{ provide: STREAM_PLAYER_PARAMS_TOKEN, useExisting: SoopPlayerParamsDirective }],
})
export class SoopPlayerParamsDirective implements StreamPlayerParams {
  public userId = input<string | null>(null);
  public videoId = input<string | null>(null);
  public width = input<string | number, string | number>('100%', { transform: streamSizeAttribute });
  public height = input<string | number, string | number>('100%', { transform: streamSizeAttribute });

  private missingSourceId = `soop-missing-${randomId()}`;

  public playerId = computed(() => {
    const userId = this.userId();
    const videoId = this.videoId();

    if (userId) return `soop-user-${userId}`;

    return videoId ? `soop-video-${videoId}` : this.missingSourceId;
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
