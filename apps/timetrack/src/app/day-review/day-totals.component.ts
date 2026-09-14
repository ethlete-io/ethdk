import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { StreamDay, formatDurationMs } from '@ethlete/timetrack';
import { DayConcurrencyComponent } from './day-concurrency.component';
import { formatBreak, formatRebuilt, formatUnattended } from './stream-format';

/**
 * What the day totalled: wall-clock presence, every stream's time summed, and the ratio between them.
 * The ratio is the number a concurrent day is read by — one hour at the machine that booked three is
 * not a broken reading, it is what running agents beside you looks like.
 *
 * Every number here is measured, and no number the day books is. Read beside the bands the two
 * disagree by whatever the rounding moved, which is why it lives in the debug panel rather than on
 * the day: a reviewer reads the footer for what the day writes, and opens this only to ask what the
 * collectors saw.
 */
@Component({
  selector: 'ethlete-day-totals',
  template: `
    <div class="flex flex-wrap items-baseline gap-x-8 gap-y-2" data-totals>
      <span class="text-large" data-presence>{{ presence() }} present</span>
      <span class="text-large" data-engaged>{{ engaged() }} engaged</span>
      <ethlete-day-concurrency [concurrency]="day()?.concurrency ?? 0" />

      @if (unattended(); as unattended) {
        <span class="text-small text-et-surface-subtle" data-unattended-total>+ {{ unattended }}</span>
      }
      @if (away(); as away) {
        <span class="text-small text-et-surface-subtle" data-break-total>{{ away }}</span>
      }
      @if (rebuilt(); as rebuilt) {
        <span class="text-small text-et-brand-ink" data-rebuilt-total>{{ rebuilt }}</span>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [DayConcurrencyComponent],
})
export class DayTotalsComponent {
  public day = input.required<StreamDay | null>();

  protected presence = computed(() => formatDurationMs(this.day()?.presenceMs ?? 0));
  protected engaged = computed(() => formatDurationMs(this.day()?.engagedMs ?? 0));
  protected unattended = computed(() => formatUnattended(this.day()?.unattendedMs ?? 0));
  protected away = computed(() => formatBreak(this.day()?.breakMs ?? 0));
  protected rebuilt = computed(() => formatRebuilt(this.day()?.rebuiltMs ?? 0));
}
