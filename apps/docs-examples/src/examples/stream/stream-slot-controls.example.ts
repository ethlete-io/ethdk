import { Component, ViewEncapsulation, signal } from '@angular/core';
import {
  BADGE_IMPORTS,
  BUTTON_IMPORTS,
  DESCRIPTION_LIST_IMPORTS,
  STREAM_DEFAULT_COMPONENTS,
  STREAM_IMPORTS,
  STREAM_YOUTUBE_IMPORTS,
  provideStreamConfig,
} from '@ethlete/components';

@Component({
  selector: 'app-stream-slot-controls-example',
  template: `
    <et-youtube-player-slot #slot class="example-stream-player" videoId="dQw4w9WgXcQ" />

    <div class="app-example-row">
      <button (click)="send('Play', slot.controls.play())" et-button type="button">Play</button>
      <button (click)="send('Pause', slot.controls.pause())" et-button type="button">Pause</button>
      <button (click)="send('Mute', slot.controls.mute())" et-button type="button">Mute</button>
      <button (click)="send('Unmute', slot.controls.unmute())" et-button type="button">Unmute</button>
      <button (click)="send('Seek to 0:30', slot.controls.seek(30))" et-button type="button">Seek to 0:30</button>
    </div>

    <dl et-description-list>
      <dt>Last command</dt>
      <dd>
        @if (lastCommand(); as command) {
          <span class="app-example-row example-stream-command">
            {{ command.name }}
            <et-badge [color]="command.sent ? 'success' : 'warning'" size="sm">
              {{ command.sent ? 'Sent' : 'Not sent' }}
            </et-badge>
          </span>
        } @else {
          -
        }
      </dd>
      <dt>Player</dt>
      <dd>{{ slot.controls.currentPlayerId() ?? '-' }}</dd>
      <dt>Playback</dt>
      <dd>{{ slot.controls.currentState().isPlaying ? 'Playing' : 'Paused' }}</dd>
      <dt>Sound</dt>
      <dd>{{ slot.controls.currentState().isMuted ? 'Muted' : 'On' }}</dd>
    </dl>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS, BUTTON_IMPORTS, BADGE_IMPORTS, DESCRIPTION_LIST_IMPORTS],
  providers: [...provideStreamConfig(STREAM_DEFAULT_COMPONENTS)],
  styles: `
    .example-stream-player {
      display: block;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
    }

    .example-stream-command > .et-badge {
      align-self: center;
    }
  `,
})
export class StreamSlotControlsExampleComponent {
  protected lastCommand = signal<{ name: string; sent: boolean } | null>(null);

  protected send(name: string, sent: boolean) {
    this.lastCommand.set({ name, sent });
  }
}
