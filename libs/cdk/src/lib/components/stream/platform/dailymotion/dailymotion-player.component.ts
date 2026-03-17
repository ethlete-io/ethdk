import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { DAILYMOTION_PLAYER_TOKEN, DailymotionPlayerDirective } from './dailymotion-player.directive';

@Component({
  selector: 'et-dailymotion-player',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: DailymotionPlayerDirective,
      inputs: ['videoId', 'startTime', 'width', 'height'],
    },
  ],
  host: {
    class: 'et-dailymotion-player',
  },
})
export class DailymotionPlayerComponent {
  private player = inject(DAILYMOTION_PLAYER_TOKEN);

  state = this.player.state;
  error = this.player.error;

  retry(): void {
    this.player.retry();
  }
}
