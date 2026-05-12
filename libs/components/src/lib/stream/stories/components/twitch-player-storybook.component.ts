import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { TwitchPlayerSlotComponent } from '../../platform/twitch/twitch-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-twitch-player',
  template: `
    <et-twitch-player-slot [src]="src()" [width]="width()" [height]="height()" [autoplay]="autoplay()" />

    <div class="mt-4 font-mono text-small">
      <strong>State:</strong>
      <pre class="bg-neutral-950 p-2 rounded mt-1">{{ player().slotDirective.slot.currentState() | json }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StreamImports, JsonPipe],
})
export class TwitchPlayerStorybookComponent {
  protected player = viewChild.required(TwitchPlayerSlotComponent);

  src = input.required<string>();
  width = input<string | number>('100%');
  height = input<string | number>(360);
  autoplay = input(false);
}
