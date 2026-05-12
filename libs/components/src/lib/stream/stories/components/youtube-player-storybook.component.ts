import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { YoutubePlayerSlotComponent } from '../../platform/youtube/youtube-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-youtube-player',
  template: `
    <et-youtube-player-slot [videoId]="videoId()" [width]="width()" [height]="height()" />

    <div class="mt-4 font-mono text-small">
      <strong>State:</strong>
      <pre class="bg-neutral-950 p-2 rounded mt-1">{{ player().slotDirective.slot.currentState() | json }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StreamImports, JsonPipe],
})
export class YoutubePlayerStorybookComponent {
  protected player = viewChild.required(YoutubePlayerSlotComponent);

  videoId = input('dQw4w9WgXcQ');
  width = input<string | number>('100%');
  height = input<string | number>(360);
}
