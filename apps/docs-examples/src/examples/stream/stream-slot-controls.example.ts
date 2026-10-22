import { JsonPipe } from '@angular/common';
import { Component, ViewEncapsulation, signal } from '@angular/core';
import {
  BUTTON_IMPORTS,
  STREAM_DEFAULT_COMPONENTS,
  STREAM_IMPORTS,
  STREAM_YOUTUBE_IMPORTS,
  provideStreamConfig,
} from '@ethlete/components';

@Component({
  selector: 'app-stream-slot-controls-example',
  template: `
    <et-youtube-player-slot #slot class="example-stream-player" videoId="dQw4w9WgXcQ" />

    <div class="example-stream-actions">
      <button (click)="sent.set(slot.controls.play())" et-button type="button">Play</button>
      <button (click)="sent.set(slot.controls.pause())" et-button type="button">Pause</button>
      <button (click)="sent.set(slot.controls.mute())" et-button type="button">Mute</button>
      <button (click)="sent.set(slot.controls.unmute())" et-button type="button">Unmute</button>
      <button (click)="sent.set(slot.controls.seek(30))" et-button type="button">Seek to 0:30</button>
    </div>

    <p>Last command sent: {{ sent() ?? '-' }} · player id: {{ slot.controls.currentPlayerId() }}</p>
    <pre>{{ slot.controls.currentState() | json }}</pre>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS, BUTTON_IMPORTS, JsonPipe],
  providers: [...provideStreamConfig(STREAM_DEFAULT_COMPONENTS)],
  styles: `
    .example-stream-player {
      display: block;
      inline-size: 100%;
      max-inline-size: 56rem;
      aspect-ratio: 16 / 9;
    }

    .example-stream-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-block: 16px;
    }
  `,
})
export class StreamSlotControlsExampleComponent {
  protected sent = signal<boolean | null>(null);
}
