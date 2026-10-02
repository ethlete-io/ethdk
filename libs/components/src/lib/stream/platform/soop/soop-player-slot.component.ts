import { Component, ViewEncapsulation } from '@angular/core';
import {
  STREAM_PLAYER_COMPONENT_TOKEN,
  injectStreamPlayerSlot,
  StreamPlayerSlotDirective,
} from '../../stream-player-slot.directive';
import { SoopPlayerParamsDirective } from './headless/soop-player-params.directive';
import { SoopPlayerComponent } from './soop-player.component';

@Component({
  selector: 'et-soop-player-slot',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: STREAM_PLAYER_COMPONENT_TOKEN, useValue: SoopPlayerComponent }],
  hostDirectives: [
    {
      directive: SoopPlayerParamsDirective,
      inputs: ['userId', 'videoId', 'width', 'height'],
    },
    {
      directive: StreamPlayerSlotDirective,
      inputs: ['streamSlotPriority', 'streamSlotOnPipBack'],
    },
  ],
  host: {
    class: 'et-soop-player-slot et-stream-player-slot',
  },
})
export class SoopPlayerSlotComponent {
  /** The slot handle: `currentState()`, `capabilities()`, the playback controls and `pipActivate()`. */
  public controls = injectStreamPlayerSlot();
}
