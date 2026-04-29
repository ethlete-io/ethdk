import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { TwitchPlayerParamsDirective } from './headless/twitch-player-params.directive';
import { TWITCH_PLAYER_TOKEN, TwitchPlayerDirective } from './headless/twitch-player.directive';

@Component({
  selector: 'et-twitch-player',
  template: '',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: TwitchPlayerParamsDirective,
      inputs: ['src', 'width', 'height', 'autoplay', 'chat', 'startTime'],
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
