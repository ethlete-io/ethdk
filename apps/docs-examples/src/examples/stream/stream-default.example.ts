import { JsonPipe } from '@angular/common';
import { Component, ViewEncapsulation, viewChild } from '@angular/core';
import {
  STREAM_DEFAULT_COMPONENTS,
  STREAM_IMPORTS,
  STREAM_YOUTUBE_IMPORTS,
  YoutubePlayerSlotComponent,
  provideStreamConfig,
} from '@ethlete/components';

@Component({
  selector: 'app-stream-default-example',
  template: `
    <et-youtube-player-slot class="example-stream-player" videoId="dQw4w9WgXcQ" />

    <p class="example-stream-label">State</p>
    <pre class="example-stream-state">{{ player().controls.currentState() | json }}</pre>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS, JsonPipe],
  providers: [provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS })],
  styles: `
    .example-stream-player {
      display: block;
      inline-size: 100%;
      max-inline-size: 56rem;
      aspect-ratio: 16 / 9;
    }

    .example-stream-label {
      margin: 16px 0 4px;
      opacity: 0.6;
    }

    .example-stream-state {
      margin: 0;
      padding: 12px;
      overflow: auto;
      border-radius: 6px;
      background: var(--et-surface-background-solid);
    }
  `,
})
export class StreamDefaultExampleComponent {
  protected player = viewChild.required(YoutubePlayerSlotComponent);
}
