import { Component, ViewEncapsulation } from '@angular/core';
import {
  STREAM_PLAYER_COMPONENT_TOKEN,
  injectStreamPlayerSlot,
  StreamPlayerSlotDirective,
} from '../../stream-player-slot.directive';
import { TwitchPlayerParamsDirective } from './headless/twitch-player-params.directive';
import { TwitchPlayerComponent } from './twitch-player.component';

@Component({
  selector: 'et-twitch-player-slot',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: STREAM_PLAYER_COMPONENT_TOKEN, useValue: TwitchPlayerComponent }],
  hostDirectives: [
    {
      directive: TwitchPlayerParamsDirective,
      inputs: ['src', 'width', 'height', 'autoplay', 'chat', 'startTime'],
    },
    {
      directive: StreamPlayerSlotDirective,
      inputs: ['streamSlotPriority', 'streamSlotOnPipBack'],
    },
  ],
  host: {
    class: 'et-twitch-player-slot et-stream-player-slot',
  },
})
export class TwitchPlayerSlotComponent {
  /** The slot handle: `currentState()`, `capabilities()`, the playback controls and `pipActivate()`. */
  public controls = injectStreamPlayerSlot();
}
