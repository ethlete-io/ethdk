import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  CALENDAR_ERROR_CODES,
  CALENDAR_IMPORTS,
  CALENDAR_LABELS,
  CalendarCellDirective,
  CalendarComponent,
  CalendarDirective,
  CalendarGridDirective,
  CalendarHeaderDirective,
  CalendarRange,
  CalendarRangeSelectionStrategy,
  createFixedLengthRangeStrategy,
  createWeekRangeStrategy,
  DEFAULT_CALENDAR_LABELS,
  DEFAULT_CALENDAR_RANGE_STRATEGY,
  injectCalendarLabels,
  provideCalendarLabels,
  startOfCalendarUnit,
} from '../index';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const AUGUST = new Date(2026, 7, 1);

@Component({
  selector: 'et-scenario-match-day',
  imports: [CALENDAR_IMPORTS],
  providers: [provideCalendarLabels({ previousMonth: 'Zurück', week: 'KW' })],
  template: `
    <et-calendar
      [(value)]="matchDay"
      [(activeMonth)]="month"
      [min]="min"
      [max]="max"
      [dateFilter]="weekdaysOnly"
      [dateClass]="highlightDerby"
      [firstDayOfWeek]="1"
      (monthSelect)="months.push($event)"
      (yearSelect)="years.push($event)"
      nextMonthLabel="Weiter"
      weekNumbers
    />
  `,
})
class MatchDayComponent {
  matchDay = signal<Date | null>(null);
  month = signal<Date | null>(AUGUST);
  min = new Date(2026, 6, 15);
  max = new Date(2026, 9, 20);
  months: Date[] = [];
  years: Date[] = [];
  labels = injectCalendarLabels();
  weekdaysOnly = (date: Date) => date.getDay() !== 0 && date.getDay() !== 6;
  highlightDerby = (date: Date) => (date.getDate() === 14 ? 'derby' : null);
}

@Component({
  selector: 'et-scenario-tournament-window',
  imports: [CalendarComponent],
  template: `
    <et-calendar
      [(rangeValue)]="window"
      [rangeSelectionStrategy]="strategy()"
      [activeMonth]="month"
      [firstDayOfWeek]="1"
      mode="range"
    />
  `,
})
class TournamentWindowComponent {
  window = signal<CalendarRange>({ start: null, end: null });
  strategy = signal<CalendarRangeSelectionStrategy>(DEFAULT_CALENDAR_RANGE_STRATEGY);
  month = AUGUST;
}

@Component({
  selector: 'et-scenario-season-month',
  imports: [CalendarComponent, CalendarHeaderDirective],
  providers: [{ provide: CALENDAR_LABELS, useValue: () => ({ switchToMultiYearView: 'Jahr wählen' }) }],
  template: `
    <et-calendar [(value)]="month" [startAt]="startAt" precision="month" startView="year">
      <ng-template etCalendarHeader let-calendar>
        <button [disabled]="!calendar.canGoPrev()" (click)="calendar.previous()" class="own-previous" type="button">
          Back
        </button>
        <span class="own-label">{{ calendar.headerLabel() }}</span>
        <button (click)="calendar.next()" class="own-next" type="button">Next</button>
      </ng-template>
    </et-calendar>
    <et-calendar [activeMonth]="startAt" class="plain" />
  `,
})
class SeasonMonthComponent {
  month = signal<Date | null>(null);
  startAt = new Date(2026, 3, 9);
}

@Component({
  selector: 'et-scenario-training-days',
  imports: [CalendarDirective, CalendarGridDirective, CalendarCellDirective],
  template: `
    <section #cal="etCalendar" [(multipleValue)]="days" [activeMonth]="month" etCalendar mode="multiple">
      <h3 class="training-label">{{ cal.headerLabel() }}</h3>
      <div class="training-grid" etCalendarGrid>
        @for (week of cal.weeks(); track $index) {
          <div role="row">
            @for (cell of week; track cell.date.getTime()) {
              <button [cell]="cell" class="training-day" etCalendarCell type="button">{{ cell.label }}</button>
            }
          </div>
        }
      </div>
    </section>
  `,
})
class TrainingDaysComponent {
  days = signal<Date[]>([]);
  month = AUGUST;
}

@Component({
  selector: 'et-scenario-stray-grid',
  imports: [CalendarGridDirective],
  template: '<div etCalendarGrid></div>',
})
class StrayGridComponent {}

@Component({
  selector: 'et-scenario-stray-cell',
  imports: [CalendarCellDirective],
  template: '<button [cell]="cell" etCalendarCell type="button">1</button>',
})
class StrayCellComponent {
  cell = {
    date: AUGUST,
    label: '1',
    ariaLabel: 'Saturday, August 1st, 2026',
    selected: false,
    disabled: false,
    today: false,
    focused: false,
    rangeStart: false,
    rangeEnd: false,
    inRange: false,
    inHoverPreview: false,
    band: null,
    comparisonBand: null,
    outsideMonth: false,
    classes: null,
  };
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const dayCell = (host: ParentNode, day: number) => {
  const found = queryAll('[etcalendarcell]', host).find(
    (cell) => text(cell) === `${day}` && !cell.hasAttribute('data-outside-month'),
  );

  if (!found) throw new Error(`no day ${day}`);

  return found;
};

const coarseCell = (host: ParentNode, label: string) => {
  const found = queryAll('[etcalendarcell]', host).find((cell) => text(cell) === label);

  if (!found) throw new Error(`no cell ${label}`);

  return found;
};

const click = (s: Scenario, element: HTMLElement) => {
  element.click();
  s.tick();
};

const hover = (s: Scenario, element: HTMLElement) => {
  element.dispatchEvent(new MouseEvent('pointerenter'));
  s.tick();
};

const banded = (host: ParentNode) =>
  queryAll('[etcalendarcell][data-band]', host)
    .filter((cell) => !cell.hasAttribute('data-outside-month'))
    .map((cell) => Number(text(cell)));

const dropErrorContext = (s: Scenario) => {
  s.tick(1);

  const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

  if (index !== -1) s.errors.splice(index, 1);
};

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

describe('calendar scenarios', () => {
  const scenario = useScenario();

  it('picks a match day by pointer and keyboard inside the bounds and the filter', () => {
    const s = scenario();

    vi.setSystemTime(new Date(2026, 7, 10, 12));

    const fixture = TestBed.createComponent(MatchDayComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    expect(app.labels()).toEqual({ ...DEFAULT_CALENDAR_LABELS, previousMonth: 'Zurück', week: 'KW' });

    const grid = query('[role="grid"]', host);

    expect(grid.getAttribute('aria-label')).toBe('August 2026');
    expect(query('.et-calendar-nav-button--previous', host).getAttribute('aria-label')).toBe('Zurück');
    expect(query('.et-calendar-nav-button--next', host).getAttribute('aria-label')).toBe('Weiter');
    expect(query('.et-calendar-header-label', host).getAttribute('aria-label')).toBe(
      DEFAULT_CALENDAR_LABELS.switchToYearView,
    );
    expect(queryAll('.et-calendar-weekday', host).map((weekday) => weekday.getAttribute('aria-label'))[0]).toBe(
      'Monday',
    );
    expect(query('.et-calendar-week-number-heading', host).getAttribute('aria-label')).toBe('KW');
    expect(query('.et-calendar-week-number', host).getAttribute('aria-label')).toBe('KW 31');

    expect(dayCell(host, 10).getAttribute('aria-current')).toBe('date');
    expect(dayCell(host, 10).getAttribute('tabindex')).toBe('0');
    expect(dayCell(host, 14).classList.contains('derby')).toBe(true);
    expect(dayCell(host, 15).getAttribute('aria-disabled')).toBe('true');

    click(s, dayCell(host, 15));
    expect(app.matchDay()).toBeNull();

    click(s, dayCell(host, 12));
    expect(app.matchDay()).toEqual(new Date(2026, 7, 12));
    expect(dayCell(host, 12).getAttribute('aria-selected')).toBe('true');
    expect(dayCell(host, 12).getAttribute('tabindex')).toBe('0');

    dayCell(host, 12).focus();
    s.keydown('ArrowDown', dayCell(host, 12));
    s.tick();
    expect(document.activeElement).toBe(dayCell(host, 19));

    s.keydown('PageDown', document.activeElement!);
    s.tick();
    expect(app.month()).toEqual(new Date(2026, 8, 1));
    expect(grid.getAttribute('aria-label')).toBe('September 2026');
    expect(document.activeElement).toBe(dayCell(host, 19));

    click(s, query('.et-calendar-nav-button--next', host));
    expect(grid.getAttribute('aria-label')).toBe('October 2026');
    expect(query<HTMLButtonElement>('.et-calendar-nav-button--next', host).disabled).toBe(true);
    expect(dayCell(host, 21).getAttribute('aria-disabled')).toBe('true');

    click(s, query('.et-calendar-header-label', host));
    expect(host.querySelector('et-calendar')?.getAttribute('data-view')).toBe('year');
    expect(query('.et-calendar-nav-button--previous', host).getAttribute('aria-label')).toBe(
      DEFAULT_CALENDAR_LABELS.previousYear,
    );
    expect(coarseCell(host, 'Jun').getAttribute('aria-disabled')).toBe('true');

    click(s, coarseCell(host, 'Aug'));
    expect(app.months).toEqual([new Date(2026, 7, 1)]);
    expect(grid.getAttribute('aria-label')).toBe('August 2026');
    expect(app.matchDay()).toEqual(new Date(2026, 7, 12));

    click(s, query('.et-calendar-header-label', host));
    click(s, query('.et-calendar-header-label', host));
    expect(query('.et-calendar-header-label', host).getAttribute('aria-label')).toBe(
      DEFAULT_CALENDAR_LABELS.switchToMonthView,
    );

    click(s, coarseCell(host, '2026'));
    expect(app.years).toEqual([new Date(2026, 0, 1)]);
    expect(host.querySelector('et-calendar')?.getAttribute('data-view')).toBe('year');
  });

  it('builds a range with the default, week and fixed-length strategies', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TournamentWindowComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    click(s, dayCell(host, 10));
    expect(app.window()).toEqual({ start: new Date(2026, 7, 10), end: null });

    hover(s, dayCell(host, 13));
    expect(queryAll('[data-preview]', host).map((cell) => Number(text(cell)))).toEqual(range(10, 13));

    click(s, dayCell(host, 13));
    expect(app.window()).toEqual({ start: new Date(2026, 7, 10), end: new Date(2026, 7, 13) });
    expect(dayCell(host, 10).hasAttribute('data-range-start')).toBe(true);
    expect(dayCell(host, 13).hasAttribute('data-range-end')).toBe(true);
    expect(banded(host)).toEqual(range(10, 13));

    app.strategy.set(createWeekRangeStrategy({ weekStartsOn: 1 }));
    app.window.set({ start: null, end: null });
    s.tick();

    click(s, dayCell(host, 12));
    expect(app.window()).toEqual({ start: new Date(2026, 7, 10), end: null });

    click(s, dayCell(host, 20));
    expect(app.window()).toEqual({ start: new Date(2026, 7, 10), end: new Date(2026, 7, 23) });

    app.strategy.set(createFixedLengthRangeStrategy({ days: 3 }));
    s.tick();

    click(s, dayCell(host, 28));
    expect(app.window()).toEqual({ start: new Date(2026, 7, 28), end: new Date(2026, 7, 30) });
  });

  it('writes months at month precision through a custom header and raw label provider', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SeasonMonthComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const calendar = host.querySelector('et-calendar')!;

    expect(host.querySelectorAll('.et-calendar-header')).toHaveLength(1);
    expect(text(query('.own-label', calendar))).toBe('2026');
    expect(query('[role="grid"]', calendar).getAttribute('aria-label')).toBe('2026');

    click(s, query('.own-next', calendar));
    expect(text(query('.own-label', calendar))).toBe('2027');

    click(s, coarseCell(calendar, 'Mar'));
    expect(app.month()).toEqual(new Date(2027, 2, 1));
    expect(app.month()).toEqual(startOfCalendarUnit(new Date(2027, 2, 17), 'month'));
    expect(calendar.getAttribute('data-view')).toBe('year');
    expect(coarseCell(calendar, 'Mar').getAttribute('aria-selected')).toBe('true');

    const plain = query('et-calendar.plain', host);

    click(s, query('.et-calendar-header-label', plain));
    expect(query('.et-calendar-header-label', plain).getAttribute('aria-label')).toBe('Jahr wählen');
  });

  it('toggles training days on a headless calendar with its own markup', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TrainingDaysComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    expect(text(query('.training-label', host))).toBe('August 2026');
    expect(query('.training-grid', host).getAttribute('aria-multiselectable')).toBe('true');
    expect(dayCell(host, 4).getAttribute('aria-label')).toBe('Tuesday, August 4th, 2026');

    click(s, dayCell(host, 6));
    click(s, dayCell(host, 4));
    expect(app.days()).toEqual([new Date(2026, 7, 4), new Date(2026, 7, 6)]);
    expect(dayCell(host, 4).getAttribute('aria-selected')).toBe('true');

    click(s, dayCell(host, 6));
    expect(app.days()).toEqual([new Date(2026, 7, 4)]);
    expect(startOfCalendarUnit(new Date(2026, 7, 4, 18, 30), 'day')).toEqual(app.days()[0]);
  });

  it('makes the leaving week grid inert while the next month takes over', () => {
    const s = scenario();

    vi.setSystemTime(new Date(2026, 7, 10, 12));

    const fixture = TestBed.createComponent(MatchDayComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    s.flush();

    const august = query('.et-calendar-weeks', host);

    expect(august.hasAttribute('inert')).toBe(false);

    click(s, query('.et-calendar-nav-button--next', host));

    const september = query('.et-calendar-weeks', host);

    expect(september).not.toBe(august);
    expect(september.hasAttribute('inert')).toBe(false);
    expect(august.hasAttribute('inert')).toBe(true);
  });

  it('makes the leaving header label inert, so only the new month is announced', () => {
    const s = scenario();

    vi.setSystemTime(new Date(2026, 7, 10, 12));

    const fixture = TestBed.createComponent(MatchDayComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    s.flush();

    const august = query('.et-calendar-header-label-value', host);

    expect(august.hasAttribute('inert')).toBe(false);

    click(s, query('.et-calendar-nav-button--next', host));

    const september = query('.et-calendar-header-label-value', host);

    expect(september).not.toBe(august);
    expect(september.hasAttribute('inert')).toBe(false);
    expect(august.hasAttribute('inert')).toBe(true);
  });

  it.each([
    ['a grid', StrayGridComponent, CALENDAR_ERROR_CODES.GRID_OUTSIDE_CALENDAR],
    ['a cell', StrayCellComponent, CALENDAR_ERROR_CODES.CELL_OUTSIDE_CALENDAR],
  ])('refuses %s outside a calendar', (_label, component, code) => {
    const s = scenario();

    expect(() => TestBed.createComponent(component)).toThrow(`ET${code}`);
    dropErrorContext(s);
  });
});
