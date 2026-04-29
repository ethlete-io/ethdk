import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { SoopPlayerParamsDirective } from './headless/soop-player-params.directive';
import { SOOP_PLAYER_TOKEN, SoopPlayerDirective } from './headless/soop-player.directive';

@Component({
  selector: 'et-soop-player',
  template: '',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: SoopPlayerParamsDirective,
      inputs: ['userId', 'videoId', 'width', 'height'],
    },
    SoopPlayerDirective,
  ],
  host: {
    class: 'et-soop-player et-stream-player',
    style: 'display: block; width: 100%; height: 100%',
  },
})
export class SoopPlayerComponent {
  player = inject(SOOP_PLAYER_TOKEN);
}
