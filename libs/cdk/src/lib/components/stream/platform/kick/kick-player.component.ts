import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { KICK_PLAYER_TOKEN, KickPlayerDirective } from './kick-player.directive';

@Component({
  selector: 'et-kick-player',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: KickPlayerDirective,
      inputs: ['channel', 'width', 'height', 'muted'],
    },
  ],
  host: {
    class: 'et-kick-player',
  },
})
export class KickPlayerComponent {
  private player = inject(KICK_PLAYER_TOKEN);

  state = this.player.state;
  error = this.player.error;

  retry(): void {
    this.player.retry();
  }
}
