import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { readHeat } from './heat';

/**
 * How many streams ran at once, with the heat the ratio earns.
 *
 * One hour at the machine that booked three is not a broken reading, it is what running agents beside
 * you looks like — so this is the one measured number the day's own footer carries.
 */
@Component({
  selector: 'ethlete-day-concurrency',
  template: `
    <span class="flex items-baseline gap-2">
      <span class="text-small text-et-surface-muted" data-concurrency>{{ label() }} at once</span>

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
  `,
  encapsulation: ViewEncapsulation.None,
})
export class DayConcurrencyComponent {
  public concurrency = input.required<number>();

  protected label = computed(() => `${this.concurrency().toFixed(1)}×`);
  protected heat = computed(() => readHeat(this.concurrency()));
}
