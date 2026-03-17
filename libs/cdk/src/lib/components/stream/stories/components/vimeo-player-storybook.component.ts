import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { VimeoPlayerComponent } from '../../platform/vimeo/vimeo-player.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-vimeo-player',
  template: `
    <et-vimeo-player [videoId]="videoId()" [width]="width()" [height]="height()" />

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
export class VimeoPlayerStorybookComponent {
  protected player = viewChild.required(VimeoPlayerComponent);

  videoId = input<string | number>(76979871);
  width = input<string | number>('100%');
  height = input<string | number>(360);
}
