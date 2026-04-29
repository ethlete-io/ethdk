import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { DailymotionPlayerParamsDirective } from './headless/dailymotion-player-params.directive';
import { DAILYMOTION_PLAYER_TOKEN, DailymotionPlayerDirective } from './headless/dailymotion-player.directive';

@Component({
  selector: 'et-dailymotion-player',
  template: '',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: DailymotionPlayerParamsDirective,
      inputs: ['videoId', 'startTime', 'width', 'height'],
    },
    DailymotionPlayerDirective,
  ],
  host: {
    class: 'et-dailymotion-player et-stream-player',
    style: 'display: block; width: 100%; height: 100%',
  },
})
export class DailymotionPlayerComponent {
  player = inject(DAILYMOTION_PLAYER_TOKEN);
}
