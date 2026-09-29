import { Component, ViewEncapsulation, input } from '@angular/core';
import { formatDurationMs } from '@ethlete/timetrack';
import { AutoModeActivity } from './auto-mode';
import { formatClockTime, formatWeekdayLabel } from './format';

@Component({
  selector: 'ethlete-auto-mode-activity',
  template: `
    @if (entries().length) {
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        @for (entry of entries(); track entry.id) {
          <li [attr.data-auto-activity]="entry.id" [attr.data-state]="entry.state" class="flex flex-col text-small">
            <span>{{ startedAt(entry) }} · {{ entry.label }}</span>
            <span class="text-et-surface-muted">{{ meta(entry) }}</span>

            @if (entry.error) {
              <span class="text-et-error">{{ entry.error }}</span>
            }
          </li>
        }
      </ul>
    }
  `,
  encapsulation: ViewEncapsulation.None,
})
export class AutoModeActivityComponent {
  public entries = input.required<readonly AutoModeActivity[]>();

  protected startedAt(entry: AutoModeActivity) {
    return formatClockTime(new Date(entry.startedAtMs));
  }

  protected meta(entry: AutoModeActivity) {
    const tookMs = (entry.endedAtMs ?? entry.startedAtMs) - entry.startedAtMs;
    const took = tookMs < 60_000 ? `${Math.round(tookMs / 1000)}s` : formatDurationMs(tookMs);
    const state = { running: 'running', done: `done in ${took}`, failed: `failed after ${took}` }[entry.state];

    return `${formatWeekdayLabel(entry.day)} · ${state}`;
  }
}
