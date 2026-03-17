import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { TIKTOK_PLAYER_TOKEN, TikTokPlayerDirective } from './tiktok-player.directive';

@Component({
  selector: 'et-tiktok-player',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: TikTokPlayerDirective,
      inputs: ['videoId', 'width', 'height'],
    },
  ],
  host: {
    class: 'et-tiktok-player',
  },
})
export class TikTokPlayerComponent {
  private player = inject(TIKTOK_PLAYER_TOKEN);

  state = this.player.state;
  error = this.player.error;

  retry(): void {
    this.player.retry();
  }
}
