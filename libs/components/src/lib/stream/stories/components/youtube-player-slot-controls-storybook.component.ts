import { Component, ViewEncapsulation, computed, input, signal, viewChild } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { ICON_IMPORTS, PLAY_ICON, ROTATE_RIGHT_ICON, provideIcons } from '../../../icon';
import { YoutubePlayerSlotComponent } from '../../platform/youtube/youtube-player-slot.component';
import { provideStreamConfig } from '../../stream-config';
import { STREAM_DEFAULT_COMPONENTS } from '../../stream-default-components';
import { StreamPlayerState } from '../../stream.types';
import { STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS } from '../../stream.imports';

type SentCommand = { label: string; accepted: boolean };

@Component({
  selector: 'et-sb-youtube-player-slot-controls',
  template: `
    <div class="flex flex-col gap-4 p-8">
      <et-youtube-player-slot
        #slot
        [videoId]="videoId()"
        class="block w-full max-w-4xl aspect-video rounded-[20px] overflow-hidden"
      />

      <section class="et-sb-remote" etAutoSurface>
        <header class="et-sb-remote__header">
          <div class="et-sb-remote__heading">
            <p class="et-sb-remote__title">Never Gonna Give You Up</p>
            <p class="et-sb-remote__subtitle">Remote driven through <code>slot.controls</code></p>
          </div>
          <span [class.et-sb-remote__status--live]="state().isPlaying" class="et-sb-remote__status">
            {{ status() }}
          </span>
        </header>

        <div class="et-sb-remote__bar">
          <div class="et-sb-remote__group" role="group" aria-label="Playback">
            <button
              [attr.aria-pressed]="state().isPlaying"
              (click)="send('Play', slot.controls.play())"
              class="et-sb-remote__btn"
              aria-label="Play"
              type="button"
            >
              <i etIcon="et-play"></i>
            </button>
            <button
              [attr.aria-pressed]="state().isReady && !state().isPlaying"
              (click)="send('Pause', slot.controls.pause())"
              class="et-sb-remote__btn"
              aria-label="Pause"
              type="button"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14M16 5v14" />
              </svg>
            </button>
          </div>

          <div class="et-sb-remote__group" role="group" aria-label="Sound">
            <button
              [attr.aria-pressed]="state().isMuted"
              (click)="send('Mute', slot.controls.mute())"
              class="et-sb-remote__btn"
              aria-label="Mute"
              type="button"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 9h4l5-4v14l-5-4H4z" />
                <path d="m17 9 5 6m0-6-5 6" />
              </svg>
            </button>
            <button
              [attr.aria-pressed]="state().isReady && !state().isMuted"
              (click)="send('Unmute', slot.controls.unmute())"
              class="et-sb-remote__btn"
              aria-label="Unmute"
              type="button"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 9h4l5-4v14l-5-4H4z" />
                <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />
              </svg>
            </button>
          </div>

          <div class="et-sb-remote__group" role="group" aria-label="Seek">
            <button
              (click)="send('Seek to 0:30', slot.controls.seek(30))"
              class="et-sb-remote__btn et-sb-remote__btn--text"
              type="button"
            >
              <i etIcon="et-rotate-right"></i>
              0:30
            </button>
          </div>
        </div>

        <dl class="et-sb-remote__state">
          <div class="et-sb-remote__row">
            <dt>State</dt>
            <dd>{{ status() }}</dd>
          </div>
          <div class="et-sb-remote__row">
            <dt>Time</dt>
            <dd>{{ time() }}</dd>
          </div>
          <div class="et-sb-remote__row">
            <dt>Sound</dt>
            <dd>{{ state().isMuted ? 'Muted' : 'On' }}</dd>
          </div>
          <div class="et-sb-remote__row">
            <dt>Last command</dt>
            <dd>
              @if (sent(); as cmd) {
                {{ cmd.label }} · {{ cmd.accepted ? 'sent' : 'not ready' }}
              } @else {
                –
              }
            </dd>
          </div>
        </dl>
      </section>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS, ICON_IMPORTS, AutoSurfaceDirective],
  providers: [provideIcons(PLAY_ICON, ROTATE_RIGHT_ICON), ...provideStreamConfig(STREAM_DEFAULT_COMPONENTS)],
  styles: `
    .et-sb-remote {
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-width: 560px;
      padding: 16px;
      border: 1px solid var(--et-surface-border-solid, rgb(255 255 255 / 0.1));
      border-radius: 20px;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
    }

    .et-sb-remote__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .et-sb-remote__heading {
      min-width: 0;
    }

    .et-sb-remote__title {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
    }

    .et-sb-remote__subtitle {
      margin: 2px 0 0;
      font-size: 12px;
      color: var(--et-surface-color-muted-solid, currentColor);
    }

    .et-sb-remote__subtitle code {
      font-family: ui-monospace, monospace;
      font-size: 11px;
    }

    .et-sb-remote__status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex: none;
      padding: 3px 10px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--et-surface-color-solid, #fff) 8%, transparent);
      font-size: 11px;
      font-weight: 600;
    }

    .et-sb-remote__status::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--et-surface-color-muted-solid, currentColor);
    }

    .et-sb-remote__status--live::before {
      background: var(--et-theme-color-primary-solid, currentColor);
    }

    .et-sb-remote__bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .et-sb-remote__group {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--et-surface-color-solid, #fff) 7%, transparent);
    }

    .et-sb-remote__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 36px;
      height: 32px;
      padding: 0 10px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .et-sb-remote__btn i,
    .et-sb-remote__btn svg {
      width: 14px;
      height: 14px;
    }

    .et-sb-remote__btn svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .et-sb-remote__btn:hover {
      background: color-mix(in srgb, var(--et-surface-color-solid, #fff) 12%, transparent);
    }

    .et-sb-remote__btn:focus-visible {
      outline: 2px solid var(--et-theme-color-primary-solid, currentColor);
      outline-offset: 1px;
    }

    .et-sb-remote__btn[aria-pressed='true'] {
      background: var(--et-theme-color-primary-solid);
      color: var(--et-theme-color-on-primary, inherit);
    }

    .et-sb-remote__state {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1px;
      margin: 0;
      overflow: hidden;
      border: 1px solid var(--et-surface-border-solid, rgb(255 255 255 / 0.1));
      border-radius: 12px;
      background: var(--et-surface-border-solid, rgb(255 255 255 / 0.1));
    }

    .et-sb-remote__row {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 10px;
      background: var(--et-surface-background-solid);
    }

    .et-sb-remote__row dt {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--et-surface-color-muted-solid, currentColor);
    }

    .et-sb-remote__row dd {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class YoutubePlayerSlotControlsStorybookComponent {
  public videoId = input('dQw4w9WgXcQ');

  private slotRef = viewChild.required(YoutubePlayerSlotComponent);

  protected sent = signal<SentCommand | null>(null);
  protected state = computed(() => this.slotRef().controls.currentState());
  protected status = computed(() => statusOf(this.state()));
  protected time = computed(() => {
    const { currentTime, duration } = this.state();

    return duration === null ? formatTime(currentTime) : `${formatTime(currentTime)} / ${formatTime(duration)}`;
  });

  protected send(label: string, accepted: boolean) {
    this.sent.set({ label, accepted });
  }
}

const formatTime = (seconds: number | null) => {
  if (seconds === null) return '–';

  const whole = Math.floor(seconds);

  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

const statusOf = (state: StreamPlayerState) => {
  if (state.error) return 'Error';
  if (!state.isReady) return 'Loading';
  if (state.isEnded) return 'Ended';
  if (state.isPlaying) return 'Playing';

  return state.currentTime ? 'Paused' : 'Ready';
};
