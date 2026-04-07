import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { FacebookPlayerParamsDirective } from './facebook-player-params.directive';
import { FACEBOOK_PLAYER_TOKEN, FacebookPlayerDirective } from './facebook-player.directive';

@Component({
  selector: 'et-facebook-player',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: FacebookPlayerParamsDirective,
      inputs: ['videoId', 'width', 'height'],
    },
    FacebookPlayerDirective,
  ],
  host: {
    class: 'et-facebook-player et-stream-player',
    style: 'display: block; width: 100%; height: 100%',
  },
})
export class FacebookPlayerComponent {
  player = inject(FACEBOOK_PLAYER_TOKEN);
}
