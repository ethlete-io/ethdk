import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { VimeoPlayerSlotComponent } from '../../platform/vimeo/vimeo-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-vimeo-player',
  template: `
    <et-vimeo-player-slot [videoId]="videoId()" [width]="width()" [height]="height()" />

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
export class VimeoPlayerStorybookComponent {
  protected player = viewChild.required(VimeoPlayerSlotComponent);

  videoId = input<string | number>(148751763);
  width = input<string | number>('100%');
  height = input<string | number>(360);
}
