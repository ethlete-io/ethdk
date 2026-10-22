import { Component, ViewEncapsulation } from '@angular/core';
import {
  BUTTON_IMPORTS,
  STREAM_ALL_IMPORTS,
  STREAM_DEFAULT_COMPONENTS,
  provideStreamConfig,
  provideStreamPip,
} from '@ethlete/components';

@Component({
  selector: 'app-stream-mixed-aspect-ratios-example',
  template: `
    <p>
      Enter PIP on all four players to see the grid view with mixed aspect ratios (16:9 YouTube and Twitch, 9:16
      TikTok). Each cell adapts to the player's natural ratio.
    </p>

    <div class="example-stream-players">
      <section>
        <et-youtube-player-slot #youtube class="example-stream-wide" videoId="dQw4w9WgXcQ" />
        <button (click)="youtube.controls.pipActivate()" et-button size="xs" type="button">Enter PIP</button>
      </section>

      <section>
        <et-twitch-player-slot #twitch class="example-stream-wide" src="lofigirl" />
        <button (click)="twitch.controls.pipActivate()" et-button size="xs" type="button">Enter PIP</button>
      </section>

      <section>
        <et-tiktok-player-slot #tiktokA class="example-stream-tall" videoId="6718335390845095173" />
        <button (click)="tiktokA.controls.pipActivate()" et-button size="xs" type="button">Enter PIP</button>
      </section>

      <section>
        <et-tiktok-player-slot #tiktokB class="example-stream-tall" videoId="7106594312292453675" />
        <button (click)="tiktokB.controls.pipActivate()" et-button size="xs" type="button">Enter PIP</button>
      </section>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_ALL_IMPORTS, BUTTON_IMPORTS],
  providers: [
    ...provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS }),
    ...provideStreamPip({ pipChrome: { controlsColor: 'neutral' } }),
  ],
  styles: `
    .example-stream-players {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
      max-inline-size: 700px;
    }

    .example-stream-players section {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .example-stream-wide,
    .example-stream-tall {
      display: block;
      position: relative;
      inline-size: 100%;
      background: black;
    }

    .example-stream-wide {
      aspect-ratio: 16 / 9;
    }

    .example-stream-tall {
      aspect-ratio: 9 / 16;
    }

    et-pip-window {
      inline-size: 320px;
      overflow: hidden;
      border-radius: 6px;
    }

    et-pip-player {
      display: block;
      position: relative;
      overflow: hidden;
    }

    et-pip-player > *,
    et-pip-player iframe {
      display: block;
      inline-size: 100% !important;
      block-size: 100% !important;
    }
  `,
})
export class StreamMixedAspectRatiosExampleComponent {}
