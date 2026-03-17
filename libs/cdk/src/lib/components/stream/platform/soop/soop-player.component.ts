import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { SOOP_PLAYER_TOKEN, SoopPlayerDirective } from './soop-player.directive';

@Component({
  selector: 'et-soop-player',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: SoopPlayerDirective,
      inputs: ['userId', 'videoId', 'width', 'height'],
    },
  ],
  host: {
    class: 'et-soop-player',
  },
})
export class SoopPlayerComponent {
  private player = inject(SOOP_PLAYER_TOKEN);

  state = this.player.state;
  error = this.player.error;

  retry(): void {
    this.player.retry();
  }
}
