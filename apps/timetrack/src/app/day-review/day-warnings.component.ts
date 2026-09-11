import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { DayWarning, DayWarningKind } from '@ethlete/timetrack';

const HEADINGS: Record<DayWarningKind, string> = {
  'under-target': 'The day is short of its target',
  'over-target': 'The day is over its target',
  'unattributed-time': 'Some time matched no issue',
  'too-many-rows': 'This day fragmented',
  'zero-duration': 'A row rounded away to nothing',
  'meeting-overlap': 'A meeting and observed work claim the same time',
  'timer-unobserved': 'A timer ran while nothing was observed',
  'filled-time': 'Short pauses were logged as the work around them',
  'paused-time': 'You stopped collection for part of this day',
  'edited-row-drift': 'New evidence landed under a row you edited',
  'stale-edit': 'A row you edited no longer matches the day',
};

/**
 * What the reviewer should look at, on one line above the timeline.
 *
 * It is deliberately not a stack of `et-banner`s. Three of those took a third of the screen on a real
 * day, and the timeline is what the screen is for; the headings read closed, and the numbers behind
 * them are one press away.
 */
@Component({
  selector: 'ethlete-day-warnings',
  template: `
    @if (warnings().length) {
      <details class="min-w-0" data-warnings>
        <summary class="flex min-w-0 cursor-pointer items-baseline gap-2 text-small">
          <span class="shrink-0 text-et-warning-ink" data-warning-count>{{ count() }} to check</span>
          <span class="min-w-0 truncate text-et-surface-muted" data-warning-headings>{{ headings() }}</span>
        </summary>

        <ul class="mt-2 flex flex-col gap-1">
          @for (warning of entries(); track warning.kind) {
            <li [attr.data-warning]="warning.kind" class="flex flex-wrap items-baseline gap-x-3 text-small">
              <span class="text-et-warning-ink">{{ warning.heading }}</span>
              <span class="text-et-surface-muted">{{ warning.detail }}</span>
            </li>
          }
        </ul>
      </details>
    }
  `,
  encapsulation: ViewEncapsulation.None,
})
export class DayWarningsComponent {
  public warnings = input.required<readonly DayWarning[]>();

  protected entries = computed(() =>
    this.warnings().map((warning) => ({ ...warning, heading: HEADINGS[warning.kind] })),
  );

  protected count = computed(() => this.warnings().length);
  protected headings = computed(() =>
    this.entries()
      .map((warning) => warning.heading)
      .join(' · '),
  );
}
