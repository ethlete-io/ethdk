import { Component, ViewEncapsulation, computed, input, linkedSignal, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS, SLIDER_IMPORTS } from '@ethlete/components';
import { EMPTY, animationFrames, map, pairwise, switchMap, tap } from 'rxjs';
import { MotionAnswer, keyframeAt, trackBarOf } from '../../host/design-motion';

export const MOTION_SPEEDS = [0.1, 0.25, 0.5, 1] as const;

@Component({
  selector: 'ethlete-motion-timeline',
  template: `
    @let shown = answer();
    <section class="flex flex-col gap-3 rounded-md border border-surface-border bg-surface p-3" data-motion-timeline>
      <header class="flex flex-wrap items-center gap-2">
        <span class="font-mono text-small text-text">{{ shown.motion }}</span>
        <span class="text-small text-text-muted">{{ shown.from }} → {{ shown.to }}, {{ shown.mode }}</span>
        <span class="flex-1"></span>
        @for (speed of SPEEDS; track speed) {
          <button
            [pressed]="rate() === speed"
            (click)="rate.set(speed)"
            et-button
            type="button"
            variant="outline"
            color="surface"
            size="sm"
            data-motion-speed
          >
            {{ speed }}×
          </button>
        }
        <button (click)="dismiss.emit()" et-button type="button" variant="outline" color="surface" size="sm">
          Close
        </button>
      </header>
      @if (picture(); as keyframe) {
        <img
          [src]="keyframe.src"
          [alt]="shown.motion + ' at ' + keyframe.ms + ' ms'"
          class="max-h-80 self-start rounded-sm border border-surface-border"
          data-motion-picture
        />
      }
      <div class="flex items-center gap-3">
        <button (click)="toggle()" et-button type="button" variant="filled" size="sm" data-motion-play>
          {{ playing() ? 'Pause' : 'Play' }}
        </button>
        <et-slider
          [value]="time()"
          [min]="0"
          [max]="shown.end"
          [step]="1"
          (valueChange)="seek($event)"
          class="flex-1"
          aria-label="Time"
        />
        <span class="w-24 text-right font-mono text-small text-text-muted" data-motion-time>
          {{ roundedTime() }} / {{ shown.end }} ms
        </span>
      </div>
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        @for (row of tracks(); track $index) {
          <li class="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-3 text-small" data-motion-track>
            <span class="flex min-w-0 flex-col">
              <span [title]="row.track.element" class="truncate font-mono text-text">{{ row.track.element }}</span>
              <span [title]="row.track.easing" class="truncate text-text-muted">
                {{ row.label }}, {{ row.track.duration }} ms, {{ row.track.easing }}
              </span>
            </span>
            <span class="relative h-3 rounded-sm bg-surface-border">
              <span
                [style.left.%]="row.bar.left"
                [style.width.%]="row.bar.width"
                class="absolute inset-y-0 rounded-sm bg-text-muted"
              ></span>
              <span [style.left.%]="playhead()" class="absolute -inset-y-1 w-px bg-text"></span>
            </span>
          </li>
        } @empty {
          <li class="text-small text-text-muted">No animation ran.</li>
        }
      </ul>
    </section>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, SLIDER_IMPORTS],
})
export class MotionTimelineComponent {
  public answer = input.required<MotionAnswer>();
  /** The time in ms the timeline opens at. */
  public start = input(0);
  public dismiss = output();

  protected readonly SPEEDS = MOTION_SPEEDS;

  protected time = linkedSignal(() => Math.min(this.start(), this.answer().end));
  protected playing = linkedSignal<MotionAnswer, boolean>({ source: this.answer, computation: () => false });
  protected rate = signal<number>(1);

  protected roundedTime = computed(() => Math.round(this.time()));
  protected playhead = computed(() => (this.time() / Math.max(this.answer().end, 1)) * 100);
  protected picture = computed(() => keyframeAt(this.answer().keyframes, this.time()));
  protected tracks = computed(() =>
    this.answer().tracks.map((track) => ({
      track,
      label: [track.name, track.properties.join(', ') || track.kind].filter(Boolean).join(': '),
      bar: trackBarOf(track, this.answer().end),
    })),
  );

  constructor() {
    toObservable(this.playing)
      .pipe(
        switchMap((playing) =>
          playing
            ? animationFrames().pipe(
                pairwise(),
                map(([previous, next]) => next.timestamp - previous.timestamp),
              )
            : EMPTY,
        ),
        tap((elapsed) => {
          const end = this.answer().end;
          const time = Math.min(this.time() + elapsed * this.rate(), end);

          this.time.set(time);
          if (time >= end) this.playing.set(false);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected toggle() {
    if (!this.playing() && this.time() >= this.answer().end) this.time.set(0);

    this.playing.set(!this.playing());
  }

  protected seek(ms: number) {
    this.playing.set(false);
    this.time.set(ms);
  }
}
