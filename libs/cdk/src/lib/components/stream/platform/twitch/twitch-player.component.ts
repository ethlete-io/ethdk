import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { TwitchPlayerParamsDirective } from './twitch-player-params.directive';
import { TWITCH_PLAYER_TOKEN, TwitchPlayerDirective } from './twitch-player.directive';

@Component({
  selector: 'et-twitch-player',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: TwitchPlayerParamsDirective,
      inputs: ['channel', 'video', 'width', 'height', 'autoplay', 'chat', 'startTime'],
    },
    TwitchPlayerDirective,
  ],
  host: {
    class: 'et-twitch-player et-stream-player',
    style: 'display: block; width: 100%; height: 100%',
  },
})
export class TwitchPlayerComponent {
  player = inject(TWITCH_PLAYER_TOKEN);
}
