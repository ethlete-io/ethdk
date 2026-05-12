import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { SoopPlayerSlotComponent } from '../../platform/soop/soop-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-soop-player',
  template: `
    <et-soop-player-slot [userId]="userId()" [videoId]="videoId()" [width]="width()" [height]="height()" />

    <div class="mt-4 font-mono text-small">
      <strong>State:</strong>
      <pre class="bg-neutral-950 p-2 rounded mt-1">{{ player().slotDirective.slot.currentState() | json }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StreamImports, JsonPipe],
})
export class SoopPlayerStorybookComponent {
  protected player = viewChild.required(SoopPlayerSlotComponent);

  userId = input<string | null>('kbsnews');
  videoId = input<string | null>(null);
  width = input<string | number>('100%');
  height = input<string | number>(360);
}
