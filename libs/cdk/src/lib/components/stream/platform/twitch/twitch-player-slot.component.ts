import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import {
  STREAM_PLAYER_COMPONENT_TOKEN,
  STREAM_PLAYER_SLOT_TOKEN,
  StreamPlayerSlotDirective,
} from '../../stream-player-slot.directive';
import { TwitchPlayerParamsDirective } from './twitch-player-params.directive';
import { TwitchPlayerComponent } from './twitch-player.component';

@Component({
  selector: 'et-twitch-player-slot',
  template: '<ng-content />',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: STREAM_PLAYER_COMPONENT_TOKEN, useValue: TwitchPlayerComponent }],
  hostDirectives: [
    {
      directive: TwitchPlayerParamsDirective,
      inputs: ['channel', 'video', 'width', 'height', 'autoplay', 'chat', 'startTime'],
    },
    {
      directive: StreamPlayerSlotDirective,
      inputs: ['streamSlotPriority', 'streamSlotOnPipBack'],
    },
  ],
  host: {
    class: 'et-twitch-player-slot et-stream-player-slot',
  },
})
export class TwitchPlayerSlotComponent {
  slotDirective = inject(STREAM_PLAYER_SLOT_TOKEN);
}
