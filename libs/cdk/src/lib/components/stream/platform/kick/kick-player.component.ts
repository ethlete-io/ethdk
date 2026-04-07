import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { KickPlayerParamsDirective } from './kick-player-params.directive';
import { KICK_PLAYER_TOKEN, KickPlayerDirective } from './kick-player.directive';

@Component({
  selector: 'et-kick-player',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
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
