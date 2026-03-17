import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { TWITCH_PLAYER_TOKEN, TwitchPlayerDirective } from './twitch-player.directive';

@Component({
  selector: 'et-twitch-player',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: TwitchPlayerDirective,
      inputs: ['channel', 'video', 'width', 'height', 'autoplay', 'startTime'],
    },
  ],
  host: {
    class: 'et-twitch-player',
  },
})
export class TwitchPlayerComponent {
  private player = inject(TWITCH_PLAYER_TOKEN);

  state = this.player.state;
  error = this.player.error;

  retry(): void {
    this.player.retry();
  }
}
