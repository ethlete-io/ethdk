import { Component, ViewEncapsulation } from '@angular/core';
import {
  STREAM_PLAYER_COMPONENT_TOKEN,
  injectStreamPlayerSlot,
  StreamPlayerSlotDirective,
} from '../../stream-player-slot.directive';
import { DailymotionPlayerComponent } from './dailymotion-player.component';
import { DailymotionPlayerParamsDirective } from './headless/dailymotion-player-params.directive';

@Component({
  selector: 'et-dailymotion-player-slot',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: STREAM_PLAYER_COMPONENT_TOKEN, useValue: DailymotionPlayerComponent }],
  hostDirectives: [
    {
      directive: DailymotionPlayerParamsDirective,
      inputs: ['videoId', 'startTime', 'width', 'height'],
    },
    {
      directive: StreamPlayerSlotDirective,
      inputs: ['streamSlotPriority', 'streamSlotOnPipBack'],
    },
  ],
  host: {
    class: 'et-dailymotion-player-slot et-stream-player-slot',
  },
})
export class DailymotionPlayerSlotComponent {
  /** The slot handle: `currentState()`, `capabilities()`, the playback controls and `pipActivate()`. */
  public controls = injectStreamPlayerSlot();
}
