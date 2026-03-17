import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { TikTokPlayerComponent } from '../../platform/tiktok/tiktok-player.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-tiktok-player',
  template: `
    <et-tiktok-player [videoId]="videoId()" [width]="width()" [height]="height()" />

    <div class="sb-state">
      <strong>State:</strong>
      <pre>{{ player().state() | json }}</pre>
    </div>
  `,
  imports: [StreamImports, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: `
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
  protected player = viewChild.required(TikTokPlayerComponent);

  videoId = input('6718335390845095173');
  width = input<string | number>('100%');
  height = input<string | number>(740);
}
