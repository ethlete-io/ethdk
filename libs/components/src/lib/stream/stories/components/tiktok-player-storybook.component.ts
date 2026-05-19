import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { TikTokPlayerSlotComponent } from '../../platform/tiktok/tiktok-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-tiktok-player',
  template: `
    <et-tiktok-player-slot [videoId]="videoId()" class="block max-h-[60rem] aspect-9/16" />

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
export class TikTokPlayerStorybookComponent {
  public videoId = input('6718335390845095173');
  protected player = viewChild.required(TikTokPlayerSlotComponent);
}
