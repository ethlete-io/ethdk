import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { ReviewedRow, formatDurationMs } from '@ethlete/timetrack';
import { formatClockTime } from './format';

/**
 * The rows taken off the timeline, and the way back for each.
 *
 * A hidden row's time is neither written nor counted as unattributed, so without this list the day
 * would simply be short an hour with nothing to say where it went.
 */
@Component({
  selector: 'ethlete-hidden-rows',
  template: `
    <div class="flex flex-col gap-2">
      <h3 class="text-h4">Hidden</h3>

      @for (row of listed(); track row.id) {
        <div
          [attr.data-hidden-row]="row.id"
          class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3"
        >
          <span class="w-28 shrink-0 text-mono text-small text-et-surface-muted">{{ row.clock }}</span>
          <span class="w-14 shrink-0 text-small">{{ row.duration }}</span>
          <span class="min-w-0 grow truncate text-small">{{ row.label }}</span>

          <button (click)="show.emit(row.row)" et-button variant="outline" size="sm">Put back</button>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class HiddenRowsComponent {
  public rows = input.required<readonly ReviewedRow[]>();

  public show = output<ReviewedRow>();

  protected listed = computed(() =>
    this.rows().map((row) => ({
      id: row.id,
      row,
      clock: `${formatClockTime(row.from)} – ${formatClockTime(row.to)}`,
      duration: formatDurationMs(row.to.getTime() - row.from.getTime()),
      label: [row.issueKey, row.description].filter(Boolean).join(' · '),
    })),
  );
}
