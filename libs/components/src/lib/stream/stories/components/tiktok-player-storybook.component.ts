import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { TikTokPlayerSlotComponent } from '../../platform/tiktok/tiktok-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-tiktok-player',
  template: `
    <et-tiktok-player-slot [videoId]="videoId()" class="tiktok-player" />

    <div class="sb-state">
      <strong>State:</strong>
      <pre>{{ player().slotDirective.slot.currentState() | json }}</pre>
    </div>
  `,
  imports: [StreamImports, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: `
    .tiktok-player {
      display: block;
      width: 420px;
      aspect-ratio: 9 / 16;
    }
    .sb-state {
      margin-top: 16px;
      font-family: monospace;
      font-size: 13px;
    }
    .sb-state pre {
      background: #0a0a0a;
      padding: 8px;
      border-radius: 4px;
    }
  `,
})
export class TikTokPlayerStorybookComponent {
  protected player = viewChild.required(TikTokPlayerSlotComponent);

  videoId = input('6718335390845095173');
}
