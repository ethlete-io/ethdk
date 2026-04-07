import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { TwitchPlayerSlotComponent } from '../../platform/twitch/twitch-player-slot.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-twitch-player',
  template: `
    <et-twitch-player-slot
      [channel]="channel()"
      [video]="video()"
      [width]="width()"
      [height]="height()"
      [autoplay]="autoplay()"
    />

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
export class TwitchPlayerStorybookComponent {
  protected player = viewChild.required(TwitchPlayerSlotComponent);

  channel = input<string | null>(null);
  video = input<string | null>(null);
  width = input<string | number>('100%');
  height = input<string | number>(360);
  autoplay = input(false);
}
