import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { YoutubePlayerParamsDirective } from './youtube-player-params.directive';
import { YOUTUBE_PLAYER_SLOT_TOKEN, YoutubePlayerSlotDirective } from './youtube-player-slot.directive';

@Component({
  selector: 'et-youtube-player-slot',
  template: '<ng-content />',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: YoutubePlayerParamsDirective,
      inputs: ['videoId', 'startTime', 'width', 'height'],
    },
    {
      directive: YoutubePlayerSlotDirective,
      inputs: ['streamSlotPriority', 'streamSlotOnPipBack'],
    },
  ],
  host: {
    class: 'et-youtube-player-slot',
  },
})
export class YoutubePlayerSlotComponent {
  private slot = inject(YOUTUBE_PLAYER_SLOT_TOKEN);

  pipActivate(onBack?: () => void): void {
    this.slot.pipActivate(onBack);
  }

  pipDeactivate(): void {
    this.slot.pipDeactivate();
  }
}
