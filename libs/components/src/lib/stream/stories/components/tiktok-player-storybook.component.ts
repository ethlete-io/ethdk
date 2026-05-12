import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { TikTokPlayerSlotComponent } from '../../platform/tiktok/tiktok-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-tiktok-player',
  template: `
    <et-tiktok-player-slot [videoId]="videoId()" class="block w-2xl aspect-9/16" />

    <div class="mt-4 font-mono text-small">
      <strong>State:</strong>
      <pre class="bg-neutral-950 p-2 rounded mt-1">{{ player().slotDirective.slot.currentState() | json }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StreamImports, JsonPipe],
})
export class TikTokPlayerStorybookComponent {
  protected player = viewChild.required(TikTokPlayerSlotComponent);

  videoId = input('6718335390845095173');
}
