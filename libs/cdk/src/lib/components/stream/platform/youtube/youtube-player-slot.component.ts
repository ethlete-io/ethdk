import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import {
  STREAM_PLAYER_COMPONENT_TOKEN,
  STREAM_PLAYER_SLOT_TOKEN,
  StreamPlayerSlotDirective,
} from '../../stream-player-slot.directive';
import { YoutubePlayerParamsDirective } from './youtube-player-params.directive';
import { YoutubePlayerComponent } from './youtube-player.component';

@Component({
  selector: 'et-youtube-player-slot',
  template: '<ng-content />',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  slotDirective = inject(STREAM_PLAYER_SLOT_TOKEN);
}
