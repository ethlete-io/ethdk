import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { KickPlayerParamsDirective } from './headless/kick-player-params.directive';
import { KICK_PLAYER_TOKEN, KickPlayerDirective } from './headless/kick-player.directive';

@Component({
  selector: 'et-kick-player',
  template: '',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: KickPlayerParamsDirective,
      inputs: ['channel', 'width', 'height', 'muted'],
    },
    KickPlayerDirective,
  ],
  host: {
    class: 'et-kick-player et-stream-player',
    style: 'display: block; width: 100%; height: 100%',
  },
})
export class KickPlayerComponent {
  player = inject(KICK_PLAYER_TOKEN);
}
