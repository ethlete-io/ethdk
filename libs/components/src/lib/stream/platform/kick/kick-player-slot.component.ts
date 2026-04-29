import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import {
  STREAM_PLAYER_COMPONENT_TOKEN,
  STREAM_PLAYER_SLOT_TOKEN,
  StreamPlayerSlotDirective,
} from '../../stream-player-slot.directive';
import { KickPlayerParamsDirective } from './headless/kick-player-params.directive';
import { KickPlayerComponent } from './kick-player.component';

@Component({
  selector: 'et-kick-player-slot',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  slotDirective = inject(STREAM_PLAYER_SLOT_TOKEN);
}
