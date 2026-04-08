import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { YoutubePlayerParamsDirective } from './headless/youtube-player-params.directive';
import { YOUTUBE_PLAYER_TOKEN, YoutubePlayerDirective } from './headless/youtube-player.directive';

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
    class: 'et-youtube-player et-stream-player',
    style: 'display: block; width: 100%; height: 100%',
  },
})
export class YoutubePlayerComponent {
  player = inject(YOUTUBE_PLAYER_TOKEN);
}
