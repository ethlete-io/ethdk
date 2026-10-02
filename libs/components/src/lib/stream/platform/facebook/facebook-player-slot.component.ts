import { Component, ViewEncapsulation } from '@angular/core';
import {
  STREAM_PLAYER_COMPONENT_TOKEN,
  injectStreamPlayerSlot,
  StreamPlayerSlotDirective,
} from '../../stream-player-slot.directive';
import { FacebookPlayerComponent } from './facebook-player.component';
import { FacebookPlayerParamsDirective } from './headless/facebook-player-params.directive';

@Component({
  selector: 'et-facebook-player-slot',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: STREAM_PLAYER_COMPONENT_TOKEN, useValue: FacebookPlayerComponent }],
  hostDirectives: [
    {
      directive: FacebookPlayerParamsDirective,
      inputs: ['videoId', 'width', 'height'],
    },
    {
      directive: StreamPlayerSlotDirective,
      inputs: ['streamSlotPriority', 'streamSlotOnPipBack'],
    },
  ],
  host: {
    class: 'et-facebook-player-slot et-stream-player-slot',
  },
})
export class FacebookPlayerSlotComponent {
  /** The slot handle: `currentState()`, `capabilities()`, the playback controls and `pipActivate()`. */
  public controls = injectStreamPlayerSlot();
}
