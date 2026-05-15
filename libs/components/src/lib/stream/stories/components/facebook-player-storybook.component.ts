import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { FacebookPlayerSlotComponent } from '../../platform/facebook/facebook-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-facebook-player',
  template: `
    <et-facebook-player-slot [videoId]="videoId()" class="block w-full max-w-4xl aspect-video" />

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
export class FacebookPlayerStorybookComponent {
  videoId = input('10155364627206729');
  protected player = viewChild.required(FacebookPlayerSlotComponent);
}
