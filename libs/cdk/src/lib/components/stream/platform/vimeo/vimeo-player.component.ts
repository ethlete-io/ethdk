import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { VIMEO_PLAYER_TOKEN, VimeoPlayerDirective } from './vimeo-player.directive';

@Component({
  selector: 'et-vimeo-player',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: VimeoPlayerDirective,
      inputs: ['videoId', 'startTime', 'width', 'height'],
    },
  ],
  host: {
    class: 'et-vimeo-player',
  },
})
export class VimeoPlayerComponent {
  private player = inject(VIMEO_PLAYER_TOKEN);

  state = this.player.state;
  error = this.player.error;

  retry(): void {
    this.player.retry();
  }
}
