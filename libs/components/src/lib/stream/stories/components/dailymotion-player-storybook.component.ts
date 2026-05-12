import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { DailymotionPlayerSlotComponent } from '../../platform/dailymotion/dailymotion-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-dailymotion-player',
  template: `
    <et-dailymotion-player-slot [videoId]="videoId()" [width]="width()" [height]="height()" />

    <div class="mt-4 font-mono text-small">
      <strong>State:</strong>
      <pre class="bg-neutral-950 p-2 rounded mt-1">{{ player().slotDirective.slot.currentState() | json }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StreamImports, JsonPipe],
})
export class DailymotionPlayerStorybookComponent {
  protected player = viewChild.required(DailymotionPlayerSlotComponent);

  videoId = input('x84sh87');
  width = input<string | number>('100%');
  height = input<string | number>(360);
}
