import { Component, ViewEncapsulation, computed, signal, viewChildren } from '@angular/core';
import {
  BADGE_IMPORTS,
  BUTTON_IMPORTS,
  STREAM_ALL_IMPORTS,
  STREAM_DEFAULT_COMPONENTS,
  StreamPlayerSlotDirective,
  injectPipManager,
  provideStreamConfig,
  provideStreamPip,
} from '@ethlete/components';

type Video = { id: string; title: string; platform: 'youtube' | 'tiktok'; videoId: string; ratio: string };

const VIDEO_LIST: Video[] = [
  { id: 'a', title: 'Never Gonna Give You Up', platform: 'youtube', videoId: 'dQw4w9WgXcQ', ratio: '16:9' },
  { id: 'b', title: 'Lofi radio', platform: 'youtube', videoId: 'jfKfPfyJRdk', ratio: '16:9' },
  { id: 'c', title: 'Short clip', platform: 'tiktok', videoId: '6718335390845095173', ratio: '9:16' },
  { id: 'd', title: 'Another short', platform: 'tiktok', videoId: '7106594312292453675', ratio: '9:16' },
];

@Component({
  selector: 'app-stream-mixed-aspect-ratios-example',
  template: `
    <ul class="example-stream-videos">
      @for (video of VIDEOS; track video.id; let index = $index) {
        <li>
          <label class="example-stream-video">
            <input [checked]="selected().has(video.id)" (change)="toggle(video.id)" type="checkbox" />
            <span class="example-stream-video-title">{{ video.title }}</span>
            @if (isFloating(index)) {
              <et-badge color="success" size="sm">In PiP</et-badge>
            }
            <et-badge size="sm">{{ video.ratio }}</et-badge>
          </label>
        </li>
      }
    </ul>

    <div class="app-example-row">
      <button [disabled]="!selected().size" (click)="float()" et-button type="button">
        Float {{ selected().size }} in picture-in-picture
      </button>
      <button [disabled]="!pipManager.pips().length" (click)="bringBack()" et-button variant="outline" type="button">
        Bring all back
      </button>
    </div>

    <div class="example-stream-sources" aria-hidden="true">
      @for (video of VIDEOS; track video.id) {
        @if (video.platform === 'youtube') {
          <et-youtube-player-slot [videoId]="video.videoId" class="example-stream-source" />
        } @else {
          <et-tiktok-player-slot [videoId]="video.videoId" class="example-stream-source example-stream-source--tall" />
        }
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_ALL_IMPORTS, BUTTON_IMPORTS, BADGE_IMPORTS],
  providers: [
    ...provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS }),
    ...provideStreamPip({ pipChrome: { controlsColor: 'neutral' } }),
  ],
  styles: `
    .example-stream-videos {
      display: grid;
      gap: 0.8rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .example-stream-video {
      display: flex;
      align-items: center;
      gap: 1.2rem;
      padding: 1.2rem 1.6rem;
      border: 1px solid var(--et-surface-border-solid, currentColor);
      border-radius: 0.8rem;
      cursor: pointer;
    }

    .example-stream-video:has(:checked) {
      border-color: var(--et-theme-color-primary-solid, currentColor);
    }

    .example-stream-video input {
      margin: 0;
      accent-color: var(--et-theme-color-primary-solid, auto);
    }

    .example-stream-video-title {
      flex: 1;
      font-weight: 500;
    }

    .example-stream-video > .et-badge {
      align-self: center;
    }

    .example-stream-sources {
      position: fixed;
      inset-block-start: 0;
      inset-inline-start: -200vw;
      inline-size: 32rem;
    }

    .example-stream-source {
      display: block;
      aspect-ratio: 16 / 9;
    }

    .example-stream-source--tall {
      inline-size: 18rem;
      aspect-ratio: 9 / 16;
    }
  `,
})
export class StreamMixedAspectRatiosExampleComponent {
  protected pipManager = injectPipManager();
  private slots = viewChildren(StreamPlayerSlotDirective);
  protected readonly VIDEOS = VIDEO_LIST;
  protected selected = signal(new Set(VIDEO_LIST.map((video) => video.id)));

  private floatingIds = computed(() => new Set(this.pipManager.pips().map((pip) => pip.playerId)));

  protected isFloating(index: number) {
    const playerId = this.slots()[index]?.slot.currentPlayerId();

    return !!playerId && this.floatingIds().has(playerId);
  }

  protected toggle(id: string) {
    this.selected.update((selected) => {
      const next = new Set(selected);

      if (!next.delete(id)) next.add(id);

      return next;
    });
  }

  protected float() {
    this.VIDEOS.forEach((video, index) => {
      if (this.selected().has(video.id)) this.slots()[index]?.slot.pipActivate();
    });
  }

  protected bringBack() {
    for (const slot of this.slots()) slot.slot.pipDeactivate();
  }
}
