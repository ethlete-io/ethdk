import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { YoutubePlayerParamsDirective } from './youtube-player-params.directive';
import { YOUTUBE_PLAYER_TOKEN, YoutubePlayerDirective } from './youtube-player.directive';

@Component({
  selector: 'et-youtube-player',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: YoutubePlayerParamsDirective,
      inputs: ['videoId', 'startTime', 'width', 'height'],
    },
    YoutubePlayerDirective,
  ],
  host: {
    class: 'et-youtube-player',
    style: 'display: block; width: 100%; height: 100%',
  },
})
export class YoutubePlayerComponent {
  private player = inject(YOUTUBE_PLAYER_TOKEN);

  state = this.player.state;
  error = this.player.error;

  retry(): void {
    this.player.retry();
  }
}
