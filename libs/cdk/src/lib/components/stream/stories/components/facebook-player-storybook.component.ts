import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { FacebookPlayerSlotComponent } from '../../platform/facebook/facebook-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-facebook-player',
  template: `
    <et-facebook-player-slot [videoId]="videoId()" [width]="width()" [height]="height()" />

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
export class FacebookPlayerStorybookComponent {
  protected player = viewChild.required(FacebookPlayerSlotComponent);

  videoId = input('10155364627206729');
  width = input<string | number>('100%');
  height = input<string | number>(360);
}
