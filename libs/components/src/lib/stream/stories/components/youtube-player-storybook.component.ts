import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { YoutubePlayerSlotComponent } from '../../platform/youtube/youtube-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-youtube-player',
  template: `
    <et-youtube-player-slot [videoId]="videoId()" [width]="width()" [height]="height()" />

    <div class="sb-state">
      <strong>State:</strong>
      <pre>{{ player().slotDirective.slot.currentState() | json }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StreamImports, JsonPipe],
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
  protected player = viewChild.required(YoutubePlayerSlotComponent);

  videoId = input('dQw4w9WgXcQ');
  width = input<string | number>('100%');
  height = input<string | number>(360);
}
