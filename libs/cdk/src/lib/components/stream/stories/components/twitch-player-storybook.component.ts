import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { TwitchPlayerComponent } from '../../platform/twitch/twitch-player.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-twitch-player',
  template: `
    <et-twitch-player
      [channel]="channel()"
      [video]="video()"
      [width]="width()"
      [height]="height()"
      [autoplay]="autoplay()"
    />

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
export class TwitchPlayerStorybookComponent {
  protected player = viewChild.required(TwitchPlayerComponent);

  channel = input<string | null>(null);
  video = input<string | null>(null);
  width = input<string | number>('100%');
  height = input<string | number>(360);
  autoplay = input(false);
}
