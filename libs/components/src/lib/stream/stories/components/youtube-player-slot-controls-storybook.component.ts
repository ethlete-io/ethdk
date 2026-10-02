import { JsonPipe } from '@angular/common';
import { Component, ViewEncapsulation, input, signal } from '@angular/core';
import { BUTTON_IMPORTS } from '../../../button';
import { provideStreamConfig } from '../../stream-config';
import { STREAM_DEFAULT_COMPONENTS } from '../../stream-default-components';
import { STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS } from '../../stream.imports';

@Component({
  selector: 'et-sb-youtube-player-slot-controls',
  template: `
    <div class="flex flex-col gap-4 p-8">
      <et-youtube-player-slot #slot [videoId]="videoId()" class="block w-full max-w-4xl aspect-video" />

      <div class="flex flex-wrap gap-2">
        <button (click)="sent.set(slot.controls.play())" et-button type="button">Play</button>
        <button (click)="sent.set(slot.controls.pause())" et-button type="button">Pause</button>
        <button (click)="sent.set(slot.controls.mute())" et-button type="button">Mute</button>
        <button (click)="sent.set(slot.controls.unmute())" et-button type="button">Unmute</button>
        <button (click)="sent.set(slot.controls.seek(30))" et-button type="button">Seek to 0:30</button>
      </div>

      <p>Last command sent: {{ sent() ?? '-' }} · player id: {{ slot.controls.currentPlayerId() }}</p>
      <pre>{{ slot.controls.currentState() | json }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS, BUTTON_IMPORTS, JsonPipe],
  providers: [...provideStreamConfig(STREAM_DEFAULT_COMPONENTS)],
})
export class YoutubePlayerSlotControlsStorybookComponent {
  public videoId = input('dQw4w9WgXcQ');

  protected sent = signal<boolean | null>(null);
}
