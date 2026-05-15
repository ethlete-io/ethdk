import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { VimeoPlayerSlotComponent } from '../../platform/vimeo/vimeo-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-vimeo-player',
  template: `
    <et-vimeo-player-slot [videoId]="videoId()" class="block w-full max-w-4xl aspect-video" />

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
export class VimeoPlayerStorybookComponent {
  videoId = input<string | number>(148751763);
  protected player = viewChild.required(VimeoPlayerSlotComponent);
}
