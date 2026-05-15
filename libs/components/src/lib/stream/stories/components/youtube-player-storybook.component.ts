import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { YoutubePlayerSlotComponent } from '../../platform/youtube/youtube-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-youtube-player',
  template: `
    <et-youtube-player-slot [videoId]="videoId()" class="block w-full max-w-4xl aspect-video" />

    <div class="mt-6 bg-neutral-900 rounded-lg p-4">
      <p class="text-xs font-mono text-neutral-400 mb-2">State</p>
      <pre class="bg-neutral-950 rounded p-3 text-xs font-mono text-neutral-300 m-0 overflow-auto">{{
        player().slotDirective.slot.currentState() | json
      }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StreamImports, JsonPipe],
})
export class YoutubePlayerStorybookComponent {
  videoId = input('dQw4w9WgXcQ');
  protected player = viewChild.required(YoutubePlayerSlotComponent);
}
