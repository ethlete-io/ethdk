import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import {
  STREAM_PLAYER_COMPONENT_TOKEN,
  STREAM_PLAYER_SLOT_TOKEN,
  StreamPlayerSlotDirective,
} from '../../stream-player-slot.directive';
import { SoopPlayerParamsDirective } from './soop-player-params.directive';
import { SoopPlayerComponent } from './soop-player.component';

@Component({
  selector: 'et-soop-player-slot',
  template: '<ng-content />',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  slotDirective = inject(STREAM_PLAYER_SLOT_TOKEN);
}
