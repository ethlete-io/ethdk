import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { YoutubePlayerComponent } from '../../platform/youtube/youtube-player.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-youtube-player',
  template: `
    <et-youtube-player [videoId]="videoId()" [width]="width()" [height]="height()" />

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
export class YoutubePlayerStorybookComponent {
  protected player = viewChild.required(YoutubePlayerComponent);

  videoId = input('dQw4w9WgXcQ');
  width = input<string | number>('100%');
  height = input<string | number>(360);
}
