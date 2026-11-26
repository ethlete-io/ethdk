import { Component, ViewEncapsulation, computed, viewChild } from '@angular/core';
import {
  BADGE_IMPORTS,
  DESCRIPTION_LIST_IMPORTS,
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

    <dl et-description-list>
      <dt>Status</dt>
      <dd>
        <et-badge [color]="status().color" size="sm">{{ status().label }}</et-badge>
      </dd>
      <dt>Sound</dt>
      <dd>{{ state().isMuted ? 'Muted' : 'On' }}</dd>
      <dt>Position</dt>
      <dd>{{ position() }}</dd>
    </dl>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS, BADGE_IMPORTS, DESCRIPTION_LIST_IMPORTS],
  providers: [provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS })],
  styles: `
    .example-stream-player {
      display: block;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
    }
  `,
})
export class StreamDefaultExampleComponent {
  private player = viewChild.required(YoutubePlayerSlotComponent);

  protected state = computed(() => this.player().controls.currentState());
  protected status = computed((): { label: string; color: string | null } => {
    const state = this.state();

    if (state.error) return { label: 'Error', color: 'danger' };
    if (state.isLoading || !state.isReady) return { label: 'Loading', color: null };
    if (state.isEnded) return { label: 'Ended', color: null };

    return state.isPlaying ? { label: 'Playing', color: 'success' } : { label: 'Paused', color: 'warning' };
  });
  protected position = computed(() => {
    const { currentTime, duration } = this.state();

    if (duration === null) return '-';

    return `${formatTime(currentTime)} / ${formatTime(duration)}`;
  });
}

const formatTime = (seconds: number | null) => {
  if (seconds === null) return '-';

  const whole = Math.floor(seconds);

  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};
