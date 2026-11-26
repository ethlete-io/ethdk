import { Component, ViewEncapsulation, inject } from '@angular/core';
import { FacebookPlayerParamsDirective } from './headless/facebook-player-params.directive';
import { FACEBOOK_PLAYER_TOKEN, FacebookPlayerDirective } from './headless/facebook-player.directive';

@Component({
  selector: 'et-facebook-player',
  template: '',
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
    '[style.display]': '"block"',
    '[style.width]': '"100%"',
    '[style.height]': '"100%"',
  },
})
export class FacebookPlayerComponent {
  public player = inject(FACEBOOK_PLAYER_TOKEN);
}
