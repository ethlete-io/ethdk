import { Component, ViewEncapsulation, computed, input, signal } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';
import { addDays, addMonths, startOfDay, startOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarRange } from '../headless';
import { CALENDAR_IMPORTS } from '../calendar.imports';

@Component({
  selector: 'et-sb-calendar',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col items-start gap-4 p-8 font-sans">
      @if (mode() === 'range') {
        <et-calendar
          [(rangeValue)]="rangeValue"
          [min]="minDate()"
          [max]="maxDate()"
          [dateFilter]="filterFn()"
          [startAt]="startAtDate()"
          [locale]="localeObject()"
          mode="range"
        />

        <p class="text-sm opacity-60">
          Range: {{ rangeValue().start?.toDateString() ?? 'null' }} → {{ rangeValue().end?.toDateString() ?? 'null' }}
        </p>
      } @else {
        <et-calendar
          [(value)]="value"
          [min]="minDate()"
          [max]="maxDate()"
          [dateFilter]="filterFn()"
          [startAt]="startAtDate()"
          [locale]="localeObject()"
        />

        <p class="text-sm opacity-60">Value: {{ value()?.toDateString() ?? 'null' }}</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...CALENDAR_IMPORTS, ProvideColorDirective],
})
export class CalendarStorybookComponent {
  public mode = input<'single' | 'range'>('single');
  public constrained = input(false);
  public disableWeekends = input(false);
  /** Months from today the empty calendar should open at — the story turns it into a `Date`. */
  public startAtMonthOffset = input<number | null>(null);
  public locale = input<'default' | 'de'>('default');
  public color = input('brand');

  public value = signal<Date | null>(null);
  public rangeValue = signal<CalendarRange>({ start: null, end: null });

  protected minDate = computed(() => (this.constrained() ? startOfDay(addDays(new Date(), -7)) : null));
  protected maxDate = computed(() => (this.constrained() ? startOfDay(addDays(new Date(), 60)) : null));

  protected filterFn = computed(() =>
    this.disableWeekends() ? (date: Date) => date.getDay() !== 0 && date.getDay() !== 6 : null,
  );

  protected startAtDate = computed(() => {
    const offset = this.startAtMonthOffset();

    return offset === null ? null : startOfMonth(addMonths(new Date(), offset));
  });

  protected localeObject = computed(() => (this.locale() === 'de' ? de : null));
}
