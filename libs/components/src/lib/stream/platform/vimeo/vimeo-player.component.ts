import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { VimeoPlayerParamsDirective } from './headless/vimeo-player-params.directive';
import { VIMEO_PLAYER_TOKEN, VimeoPlayerDirective } from './headless/vimeo-player.directive';

@Component({
  selector: 'et-vimeo-player',
  template: '',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: VimeoPlayerParamsDirective,
      inputs: ['videoId', 'startTime', 'width', 'height'],
    },
    VimeoPlayerDirective,
  ],
  host: {
    class: 'et-vimeo-player et-stream-player',
    style: 'display: block; width: 100%; height: 100%',
  },
})
export class VimeoPlayerComponent {
  player = inject(VIMEO_PLAYER_TOKEN);
}
