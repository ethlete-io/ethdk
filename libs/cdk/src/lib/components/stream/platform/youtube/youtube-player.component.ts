import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { YOUTUBE_PLAYER_TOKEN, YoutubePlayerDirective } from './youtube-player.directive';

@Component({
  selector: 'et-youtube-player',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: YoutubePlayerDirective,
      inputs: ['videoId', 'startTime', 'width', 'height'],
    },
  ],
  host: {
    class: 'et-youtube-player',
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
