import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { KickPlayerSlotComponent } from '../../platform/kick/kick-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-kick-player',
  template: `
    <et-kick-player-slot [channel]="channel()" [width]="width()" [height]="height()" />

    <div class="sb-state">
      <strong>State:</strong>
      <pre>{{ player().slotDirective.slot.currentState() | json }}</pre>
    </div>
  `,
  imports: [StreamImports, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: `
    .sb-state {
      margin-top: 16px;
      font-family: monospace;
      font-size: 13px;
    }
    .sb-state pre {
      background: #0a0a0a;
      padding: 8px;
      border-radius: 4px;
    }
  `,
})
export class KickPlayerStorybookComponent {
  protected player = viewChild.required(KickPlayerSlotComponent);

  channel = input('xqc');
  width = input<string | number>('100%');
  height = input<string | number>(360);
}
