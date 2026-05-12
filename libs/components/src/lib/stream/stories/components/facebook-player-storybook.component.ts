import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { FacebookPlayerSlotComponent } from '../../platform/facebook/facebook-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-facebook-player',
  template: `
    <et-facebook-player-slot [videoId]="videoId()" [width]="width()" [height]="height()" />

    <div class="mt-4 font-mono text-small">
      <strong>State:</strong>
      <pre class="bg-neutral-950 p-2 rounded mt-1">{{ player().slotDirective.slot.currentState() | json }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StreamImports, JsonPipe],
})
export class FacebookPlayerStorybookComponent {
  protected player = viewChild.required(FacebookPlayerSlotComponent);

  videoId = input('10155364627206729');
  width = input<string | number>('100%');
  height = input<string | number>(360);
}
