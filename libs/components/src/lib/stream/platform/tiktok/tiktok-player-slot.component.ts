import { Component, ViewEncapsulation } from '@angular/core';
import {
  STREAM_PLAYER_COMPONENT_TOKEN,
  injectStreamPlayerSlot,
  StreamPlayerSlotDirective,
} from '../../stream-player-slot.directive';
import { TikTokPlayerParamsDirective } from './headless/tiktok-player-params.directive';
import { TikTokPlayerComponent } from './tiktok-player.component';

@Component({
  selector: 'et-tiktok-player-slot',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: STREAM_PLAYER_COMPONENT_TOKEN, useValue: TikTokPlayerComponent }],
  hostDirectives: [
    {
      directive: TikTokPlayerParamsDirective,
      inputs: ['videoId', 'width', 'height'],
    },
    {
      directive: StreamPlayerSlotDirective,
      inputs: ['streamSlotPriority', 'streamSlotOnPipBack'],
    },
  ],
  host: {
    class: 'et-tiktok-player-slot et-stream-player-slot',
  },
})
export class TikTokPlayerSlotComponent {
  /** The slot handle: `currentState()`, `capabilities()`, the playback controls and `pipActivate()`. */
  public controls = injectStreamPlayerSlot();
}
