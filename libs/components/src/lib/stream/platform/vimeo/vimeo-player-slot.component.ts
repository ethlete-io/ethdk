import { Component, ViewEncapsulation } from '@angular/core';
import {
  STREAM_PLAYER_COMPONENT_TOKEN,
  injectStreamPlayerSlot,
  StreamPlayerSlotDirective,
} from '../../stream-player-slot.directive';
import { VimeoPlayerParamsDirective } from './headless/vimeo-player-params.directive';
import { VimeoPlayerComponent } from './vimeo-player.component';

@Component({
  selector: 'et-vimeo-player-slot',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: STREAM_PLAYER_COMPONENT_TOKEN, useValue: VimeoPlayerComponent }],
  hostDirectives: [
    {
      directive: VimeoPlayerParamsDirective,
      inputs: ['videoId', 'startTime', 'width', 'height'],
    },
    {
      directive: StreamPlayerSlotDirective,
      inputs: ['streamSlotPriority', 'streamSlotOnPipBack'],
    },
  ],
  host: {
    class: 'et-vimeo-player-slot et-stream-player-slot',
  },
})
export class VimeoPlayerSlotComponent {
  /** The slot handle: `currentState()`, `capabilities()`, the playback controls and `pipActivate()`. */
  public controls = injectStreamPlayerSlot();
}
