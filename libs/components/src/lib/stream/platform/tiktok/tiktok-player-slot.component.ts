import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import {
  STREAM_PLAYER_COMPONENT_TOKEN,
  STREAM_PLAYER_SLOT_TOKEN,
  StreamPlayerSlotDirective,
} from '../../stream-player-slot.directive';
import { TikTokPlayerParamsDirective } from './headless/tiktok-player-params.directive';
import { TikTokPlayerComponent } from './tiktok-player.component';

@Component({
  selector: 'et-tiktok-player-slot',
  template: '<ng-content />',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  slotDirective = inject(STREAM_PLAYER_SLOT_TOKEN);
}
