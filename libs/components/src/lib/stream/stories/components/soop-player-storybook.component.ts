import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { SoopPlayerSlotComponent } from '../../platform/soop/soop-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-soop-player',
  template: `
    <et-soop-player-slot [userId]="userId()" [videoId]="videoId()" [width]="width()" [height]="height()" />

    <div class="sb-state">
      <strong>State:</strong>
      <pre>{{ player().slotDirective.slot.currentState() | json }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StreamImports, JsonPipe],
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
export class SoopPlayerStorybookComponent {
  protected player = viewChild.required(SoopPlayerSlotComponent);

  userId = input<string | null>('kbsnews');
  videoId = input<string | null>(null);
  width = input<string | number>('100%');
  height = input<string | number>(360);
}
