import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { FACEBOOK_PLAYER_TOKEN, FacebookPlayerDirective } from './facebook-player.directive';

@Component({
  selector: 'et-facebook-player',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: FacebookPlayerDirective,
      inputs: ['videoId', 'width', 'height'],
    },
  ],
  host: {
    class: 'et-facebook-player',
  },
})
export class FacebookPlayerComponent {
  private player = inject(FACEBOOK_PLAYER_TOKEN);

  state = this.player.state;
  error = this.player.error;

  retry(): void {
    this.player.retry();
  }
}
