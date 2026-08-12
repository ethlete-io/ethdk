import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { BADGE_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';
import { ClosedTimerRun, formatDurationMs, timerRunDurationMs } from '@ethlete/timetrack';
import { formatClockTime } from './format';

export type TimerRunLabel = { id: string; issueKey: string; note: string };

/**
 * The day's timed runs, each with the issue it is for.
 *
 * They need a list of their own rather than only the rows they become: a run nobody has named yet
 * proposes nothing, so it would otherwise be visible only as a warning about time it cannot account
 * for — and naming it here is what turns it into a worklog.
 */
@Component({
  selector: 'ethlete-timer-runs',
  template: `
    <div class="flex flex-col gap-2">
      <h3 class="text-h4">Timed by hand</h3>

      @for (run of listed(); track run.id) {
        <div class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3">
          <span class="w-28 shrink-0 text-mono text-small text-et-surface-muted">{{ run.clock }}</span>
          <span class="w-14 shrink-0 text-small">{{ run.duration }}</span>

          @if (run.open) {
            <et-badge size="sm" color="brand">running</et-badge>
          }

          <et-form-field class="w-30 shrink-0" appearance="underline" size="sm">
            <et-input
              [value]="run.issueKey"
              [attr.aria-label]="'Issue for the run at ' + run.clock"
              (valueChange)="label.emit({ id: run.id, issueKey: $event, note: run.note })"
              placeholder="Issue"
            />
          </et-form-field>

          <et-form-field class="min-w-50 grow" appearance="underline" size="sm">
            <et-input
              [value]="run.note"
              [attr.aria-label]="'Note for the run at ' + run.clock"
              (valueChange)="label.emit({ id: run.id, issueKey: run.issueKey, note: $event })"
              placeholder="What it was for"
            />
          </et-form-field>

          @if (!run.issueKey) {
            <span class="text-small text-et-warning-ink">names no issue</span>
          }
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS],
})
export class TimerRunsComponent {
  public runs = input.required<readonly ClosedTimerRun[]>();
  /** The id of the run still going, so the one that is open reads differently from the rest. */
  public openRunId = input<string | null>(null);

  public label = output<TimerRunLabel>();

  protected listed = computed(() =>
    this.runs().map((run) => ({
      id: run.id,
      clock: `${formatClockTime(run.from)} – ${formatClockTime(run.to)}`,
      duration: formatDurationMs(timerRunDurationMs(run)),
      open: run.id === this.openRunId(),
      issueKey: run.issueKey ?? '',
      note: run.note ?? '',
    })),
  );
}
