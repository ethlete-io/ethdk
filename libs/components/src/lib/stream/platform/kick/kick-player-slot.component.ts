import { Component, ViewEncapsulation } from '@angular/core';
import {
  STREAM_PLAYER_COMPONENT_TOKEN,
  injectStreamPlayerSlot,
  StreamPlayerSlotDirective,
} from '../../stream-player-slot.directive';
import { KickPlayerParamsDirective } from './headless/kick-player-params.directive';
import { KickPlayerComponent } from './kick-player.component';

@Component({
  selector: 'et-kick-player-slot',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: STREAM_PLAYER_COMPONENT_TOKEN, useValue: KickPlayerComponent }],
  hostDirectives: [
    {
      directive: KickPlayerParamsDirective,
      inputs: ['channel', 'width', 'height', 'muted'],
    },
    {
      directive: StreamPlayerSlotDirective,
      inputs: ['streamSlotPriority', 'streamSlotOnPipBack'],
    },
  ],
  host: {
    class: 'et-kick-player-slot et-stream-player-slot',
  },
})
export class KickPlayerSlotComponent {
  /** The slot handle: `currentState()`, `capabilities()`, the playback controls and `pipActivate()`. */
  public controls = injectStreamPlayerSlot();
}
