import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { TwitchPlayerSlotComponent } from '../../platform/twitch/twitch-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-twitch-player',
  template: `
    <et-twitch-player-slot [src]="src()" [autoplay]="autoplay()" class="block w-full max-w-4xl aspect-video" />

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
export class TwitchPlayerStorybookComponent {
  public src = input.required<string>();
  public autoplay = input(false);
  protected player = viewChild.required(TwitchPlayerSlotComponent);
}
