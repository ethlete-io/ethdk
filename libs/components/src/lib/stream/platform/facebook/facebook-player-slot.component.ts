import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import {
  STREAM_PLAYER_COMPONENT_TOKEN,
  STREAM_PLAYER_SLOT_TOKEN,
  StreamPlayerSlotDirective,
} from '../../stream-player-slot.directive';
import { FacebookPlayerParamsDirective } from './headless/facebook-player-params.directive';
import { FacebookPlayerComponent } from './facebook-player.component';

@Component({
  selector: 'et-facebook-player-slot',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STREAM_PLAYER_COMPONENT_TOKEN, useValue: FacebookPlayerComponent }],
  hostDirectives: [
    {
      directive: FacebookPlayerParamsDirective,
      inputs: ['videoId', 'width', 'height'],
    },
    {
      directive: StreamPlayerSlotDirective,
      inputs: ['streamSlotPriority', 'streamSlotOnPipBack'],
    },
  ],
  host: {
    class: 'et-facebook-player-slot et-stream-player-slot',
  },
})
export class FacebookPlayerSlotComponent {
  slotDirective = inject(STREAM_PLAYER_SLOT_TOKEN);
}
