import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { TikTokPlayerParamsDirective } from './headless/tiktok-player-params.directive';
import { TIKTOK_PLAYER_TOKEN, TikTokPlayerDirective } from './headless/tiktok-player.directive';

@Component({
  selector: 'et-tiktok-player',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: TikTokPlayerParamsDirective,
      inputs: ['videoId', 'width', 'height'],
    },
    TikTokPlayerDirective,
  ],
  host: {
    class: 'et-tiktok-player et-stream-player',
    style: 'display: block; width: 100%; height: 100%',
  },
})
export class TikTokPlayerComponent {
  player = inject(TIKTOK_PLAYER_TOKEN);
}
