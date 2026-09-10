import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { StreamDay, formatDurationMs } from '@ethlete/timetrack';
import { readHeat } from './heat';
import { formatRebuilt, formatUnattended } from './stream-format';

/**
 * What the day totalled, above the timeline: wall-clock presence, every stream's time summed, and the
 * ratio between them. The ratio is the number a concurrent day is read by — one hour at the machine
 * that booked three is not a broken reading, it is what running agents beside you looks like.
 */
@Component({
  selector: 'ethlete-day-totals',
  template: `
    <div class="flex flex-wrap items-baseline gap-x-8 gap-y-2" data-totals>
      <span class="text-large" data-presence>{{ presence() }} present</span>
      <span class="text-large" data-engaged>{{ engaged() }} engaged</span>
      <span class="flex items-baseline gap-2">
        <span class="text-small text-et-surface-muted" data-concurrency>{{ concurrency() }} at once</span>

        @if (heat(); as heat) {
          <span
            [attr.data-heat]="heat.level"
            [style.--_et-heat]="heat.glow"
            [title]="heat.hint"
            class="inline-flex items-baseline gap-0.5 text-small leading-none"
          >
            @for (flame of heat.flames; track flame) {
              <span [style.animation-delay.ms]="flame * 240" class="inline-block" aria-hidden="true" data-heat-flame>
                🔥
              </span>
            }
            <span class="sr-only">{{ heat.hint }}</span>
          </span>
        }
      </span>

      @if (unattended(); as unattended) {
        <span class="text-small text-et-surface-subtle" data-unattended-total>+ {{ unattended }}</span>
      }
      @if (rebuilt(); as rebuilt) {
        <span class="text-small text-et-brand-ink" data-rebuilt-total>{{ rebuilt }}</span>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class DayTotalsComponent {
  public day = input.required<StreamDay | null>();

  protected presence = computed(() => formatDurationMs(this.day()?.presenceMs ?? 0));
  protected engaged = computed(() => formatDurationMs(this.day()?.engagedMs ?? 0));
  protected concurrency = computed(() => `${(this.day()?.concurrency ?? 0).toFixed(1)}×`);
  protected heat = computed(() => readHeat(this.day()?.concurrency ?? 0));
  protected unattended = computed(() => formatUnattended(this.day()?.unattendedMs ?? 0));
  protected rebuilt = computed(() => formatRebuilt(this.day()?.rebuiltMs ?? 0));
}
