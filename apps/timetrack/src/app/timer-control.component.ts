import { Component, ViewEncapsulation, computed } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { formatDurationMs } from '@ethlete/timetrack';
import { formatClockTime } from './day-review/format';
import { injectTimer } from './timer';

/**
 * The start/stop control, in the titlebar because that band is the one part of the shell that stays on
 * screen however far the day is scrolled — a timer you cannot see is a timer you forget to stop.
 */
@Component({
  selector: 'ethlete-timer-control',
  template: `
    <div class="flex items-center gap-2">
      @if (timer.running(); as run) {
        <span class="text-mono text-small text-et-surface-muted">since {{ startedAt() }}</span>
        <button (click)="timer.toggle()" et-button variant="filled" size="sm">Stop {{ elapsed() }}</button>
      } @else {
        <button (click)="timer.toggle()" et-button variant="outline" size="sm">Start timer</button>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class TimerControlComponent {
  protected timer = injectTimer();

  protected elapsed = computed(() => formatDurationMs(this.timer.elapsedMs()));
  protected startedAt = computed(() => {
    const run = this.timer.running();

    return run ? formatClockTime(run.from) : '';
  });
}
