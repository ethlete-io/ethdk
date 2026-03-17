import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { SoopPlayerComponent } from '../../platform/soop/soop-player.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-soop-player',
  template: `
    <et-soop-player [userId]="userId()" [videoId]="videoId()" [width]="width()" [height]="height()" />

    <div class="sb-state">
      <strong>State:</strong>
      <pre>{{ player().state() | json }}</pre>
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
export class SoopPlayerStorybookComponent {
  protected player = viewChild.required(SoopPlayerComponent);

  userId = input<string | null>('kbsnews');
  videoId = input<string | null>(null);
  width = input<string | number>('100%');
  height = input<string | number>(360);
}
