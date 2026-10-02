import { Component, ViewEncapsulation } from '@angular/core';
import {
  STREAM_PLAYER_COMPONENT_TOKEN,
  injectStreamPlayerSlot,
  StreamPlayerSlotDirective,
} from '../../stream-player-slot.directive';
import { YoutubePlayerParamsDirective } from './headless/youtube-player-params.directive';
import { YoutubePlayerComponent } from './youtube-player.component';

@Component({
  selector: 'et-youtube-player-slot',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: STREAM_PLAYER_COMPONENT_TOKEN, useValue: YoutubePlayerComponent }],
  hostDirectives: [
    {
      directive: YoutubePlayerParamsDirective,
      inputs: ['videoId', 'startTime', 'width', 'height'],
    },
    {
      directive: StreamPlayerSlotDirective,
      inputs: ['streamSlotPriority', 'streamSlotOnPipBack'],
    },
  ],
  host: {
    class: 'et-youtube-player-slot et-stream-player-slot',
  },
})
export class YoutubePlayerSlotComponent {
  /** The slot handle: `currentState()`, `capabilities()`, the playback controls and `pipActivate()`. */
  public controls = injectStreamPlayerSlot();
}
