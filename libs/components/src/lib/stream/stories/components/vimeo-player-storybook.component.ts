import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { VimeoPlayerSlotComponent } from '../../platform/vimeo/vimeo-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-vimeo-player',
  template: `
    <et-vimeo-player-slot [videoId]="videoId()" [width]="width()" [height]="height()" />

    <div class="mt-4 font-mono text-small">
      <strong>State:</strong>
      <pre class="bg-neutral-950 p-2 rounded mt-1">{{ player().slotDirective.slot.currentState() | json }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StreamImports, JsonPipe],
})
export class VimeoPlayerStorybookComponent {
  protected player = viewChild.required(VimeoPlayerSlotComponent);

  videoId = input<string | number>(148751763);
  width = input<string | number>('100%');
  height = input<string | number>(360);
}
