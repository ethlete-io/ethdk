import iconButtonBase from '../src/lib/button/icon-button.component.css?inline';
import coarseGridBase from '../src/lib/calendar/calendar-coarse-grid-styles.component.css?inline';
import comparisonBandBase from '../src/lib/calendar/calendar-comparison-band-styles.component.css?inline';
import weekNumbersBase from '../src/lib/calendar/calendar-week-numbers-styles.component.css?inline';
import calendarBase from '../src/lib/calendar/calendar.component.css?inline';
import { CHEVRON_ICON } from '../src/lib/icon/headless/chevron-icon';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import { buttonStyles } from './button';
import { iconMarkup } from './icon';

export type CalendarMockRange = {
  /** An ISO date, `YYYY-MM-DD`. */
  start: string;
  /** An ISO date, `YYYY-MM-DD`. */
  end: string;
};

export type CalendarMockOptions = {
  /** Left out, `month`. */
  view?: 'month' | 'year' | 'multiYear';
  /** The visible month, as an ISO month `YYYY-MM`. */
  month: string;
  /** The first year of the year grid's page of 24. Left out, the visible year rounded down to a multiple of 24. */
  yearPageStart?: number;
  /** Today, as an ISO date. Pass a fixed date, never the real today. */
  today?: string;
  /** The selected day of a single-value calendar, as an ISO date. */
  value?: string;
  /** The selected range of a range calendar. */
  range?: CalendarMockRange;
  /** The comparison band (`etCalendarComparisonBand`). */
  comparison?: CalendarMockRange;
  /** The earliest selectable day, as an ISO date. */
  min?: string;
  /** The latest selectable day, as an ISO date. */
  max?: string;
  /** Days the date filter turns down, as ISO dates. */
  disabled?: string[];
  weekNumbers?: boolean;
  /** Left out, `1` (Monday), as `et-calendar` defaults to without a locale. */
  weekStartsOn?: number;
  /** Replaces the header label, e.g. with a localized one. */
  headerLabel?: string;
  /** Extra attributes per cell, keyed by ISO date in the month view, `YYYY-MM` in the year view and `YYYY` in the year grid. */
  cellAttributes?: Record<string, string>;
  /** Extra attributes on the previous button, e.g. design markers. */
  previousAttributes?: string;
  /** Extra attributes on the next button, e.g. design markers. */
  nextAttributes?: string;
  /** Extra attributes on the header label button, e.g. design markers. */
  labelAttributes?: string;
  /** Extra attributes on the host, e.g. a style or design markers. */
  attributes?: string;
};

type Band = 'start' | 'middle' | 'end' | 'single' | null;

type CellFlags = {
  label: string;
  key: string;
  today: boolean;
  selected: boolean;
  disabled: boolean;
  band: Band;
  comparisonBand: Band;
  outsideMonth?: boolean;
};

const DAY = 86_400_000;

const toDay = (iso: string) => {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);

  return Date.UTC(year, month - 1, day) / DAY;
};

const toIso = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);

const isoWeek = (day: number) => {
  const date = new Date(day * DAY);
  const thursday = day + 3 - ((date.getUTCDay() + 6) % 7);
  const yearStart = Date.UTC(new Date(thursday * DAY).getUTCFullYear(), 0, 1) / DAY;

  return Math.floor((thursday - yearStart) / 7) + 1;
};

const monthName = (utc: number, style: 'long' | 'short') =>
  new Intl.DateTimeFormat('en-US', { month: style, timeZone: 'UTC' }).format(utc);

const bandFor = (range: { from: number; to: number } | null, [from, to]: [number, number]): Band => {
  if (!range || to < range.from || from > range.to) return null;
  if (range.from === range.to && from <= range.from && to >= range.to) return 'single';
  if (from <= range.from) return 'start';
  if (to >= range.to) return 'end';

  return 'middle';
};

const toRange = (range: CalendarMockRange | undefined) =>
  range
    ? { from: Math.min(toDay(range.start), toDay(range.end)), to: Math.max(toDay(range.start), toDay(range.end)) }
    : null;

/** The stylesheets `calendar()` draws with: the real calendar, coarse grid, comparison band, week number, icon-button and icon CSS. */
export const calendarStyles = /* @__PURE__ */ [
  buttonStyles,
  iconBase,
  iconButtonBase,
  calendarBase,
  coarseGridBase,
  comparisonBandBase,
  weekNumbersBase,
].join('\n');

/** Draws `<et-calendar>` as HTML with its default header and the grid of one view, as a static snapshot of one state. */
export const calendar = (options: CalendarMockOptions) => {
  const { view = 'month', weekStartsOn = 1, cellAttributes = {} } = options;
  const [year = 0, monthNumber = 1] = options.month.split('-').map(Number);
  const month = monthNumber - 1;
  const monthStart = Date.UTC(year, month, 1) / DAY;
  const monthEnd = Date.UTC(year, month + 1, 0) / DAY;
  const min = options.min ? toDay(options.min) : -Infinity;
  const max = options.max ? toDay(options.max) : Infinity;
  const turnedDown = new Set((options.disabled ?? []).map(toDay));
  const today = options.today ? toDay(options.today) : null;
  const value = options.value ? toDay(options.value) : null;
  const range = toRange(options.range);
  const comparison = toRange(options.comparison);
  const pageStart = options.yearPageStart ?? Math.floor(year / 24) * 24;

  const isSelectable = (day: number) => day >= min && day <= max && !turnedDown.has(day);
  const hasSelectableDay = (from: number, to: number) => {
    for (let day = Math.max(from, min); day <= Math.min(to, max); day++) {
      if (!turnedDown.has(day)) return true;
    }

    return false;
  };

  const spanFlags = (from: number, to: number) => ({
    today: today !== null && today >= from && today <= to,
    selected:
      (value !== null && value >= from && value <= to) ||
      (range !== null && ((range.from >= from && range.from <= to) || (range.to >= from && range.to <= to))),
    band: bandFor(range, [from, to]),
    comparisonBand: bandFor(comparison, [from, to]),
  });

  const cellButton = (cell: CellFlags, coarse: boolean) => {
    const attributes = [
      cellAttributes[cell.key],
      `class="et-calendar-cell${coarse ? ' et-calendar-cell--coarse' : ''}"`,
      'type="button"',
      'tabindex="-1"',
      `aria-selected="${cell.selected}"`,
      cell.disabled && 'aria-disabled="true"',
      cell.today && 'aria-current="date"',
      cell.selected && 'data-selected=""',
      cell.disabled && 'data-disabled=""',
      cell.today && 'data-today=""',
      cell.band && `data-band="${cell.band}"`,
      cell.comparisonBand && `data-comparison-band="${cell.comparisonBand}"`,
      cell.outsideMonth && 'data-outside-month=""',
    ].filter(Boolean);

    return `<button ${attributes.join(' ')}><span class="et-calendar-cell-content">${cell.label}</span></button>`;
  };

  const coarseRows = (cells: CellFlags[]) => {
    const rows: string[] = [];

    for (let index = 0; index < cells.length; index += 4) {
      const row = cells
        .slice(index, index + 4)
        .map((cell) => cellButton(cell, true))
        .join('');
      rows.push(`<div class="et-calendar-coarse-row" role="row">${row}</div>`);
    }

    return rows.join('');
  };

  const monthGrid = () => {
    const offset = (new Date(monthStart * DAY).getUTCDay() - weekStartsOn + 7) % 7;
    const weeks: string[] = [];

    for (let weekStart = monthStart - offset; weekStart <= monthEnd; weekStart += 7) {
      const weekNumber = options.weekNumbers
        ? `<span class="et-calendar-week-number" role="rowheader">${isoWeek(weekStart)}</span>`
        : '';
      const days = Array.from({ length: 7 }, (_, index) => {
        const day = weekStart + index;

        return cellButton(
          {
            label: `${new Date(day * DAY).getUTCDate()}`,
            key: toIso(day),
            disabled: !isSelectable(day),
            outsideMonth: day < monthStart || day > monthEnd,
            ...spanFlags(day, day),
          },
          false,
        );
      }).join('');
      weeks.push(`<div class="et-calendar-week" role="row">${weekNumber}${days}</div>`);
    }

    return `<div class="et-calendar-months" role="presentation"><div class="et-calendar-month" role="presentation">${weeks.join('')}</div></div>`;
  };

  const yearGrid = () =>
    coarseRows(
      Array.from({ length: 12 }, (_, index) => {
        const from = Date.UTC(year, index, 1) / DAY;
        const to = Date.UTC(year, index + 1, 0) / DAY;

        return {
          label: monthName(from * DAY, 'short'),
          key: `${year}-${String(index + 1).padStart(2, '0')}`,
          disabled: !hasSelectableDay(from, to),
          ...spanFlags(from, to),
        };
      }),
    );

  const multiYearGrid = () =>
    coarseRows(
      Array.from({ length: 24 }, (_, index) => {
        const cellYear = pageStart + index;
        const from = Date.UTC(cellYear, 0, 1) / DAY;
        const to = Date.UTC(cellYear, 11, 31) / DAY;

        return {
          label: `${cellYear}`,
          key: `${cellYear}`,
          disabled: !hasSelectableDay(from, to),
          ...spanFlags(from, to),
        };
      }),
    );

  const weekdays = () => {
    const heading = options.weekNumbers
      ? '<span class="et-calendar-week-number-heading" role="columnheader"></span>'
      : '';
    const names = Array.from({ length: 7 }, (_, index) => {
      const name = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' })
        .format(Date.UTC(2023, 0, 1 + ((weekStartsOn + index) % 7)))
        .slice(0, 2);

      return `<span class="et-calendar-weekday" role="columnheader">${name}</span>`;
    }).join('');

    return `<div class="et-calendar-weekdays" role="row">${heading}${names}</div>`;
  };

  const [canGoPrev, canGoNext] =
    view === 'month'
      ? [min < monthStart, max > monthEnd]
      : view === 'year'
        ? [min < Date.UTC(year, 0, 1) / DAY, max > Date.UTC(year, 11, 31) / DAY]
        : [min < Date.UTC(pageStart, 0, 1) / DAY, max > Date.UTC(pageStart + 23, 11, 31) / DAY];

  const headerLabel =
    options.headerLabel ??
    (view === 'month'
      ? `${monthName(monthStart * DAY, 'long')} ${year}`
      : view === 'year'
        ? `${year}`
        : `${pageStart} – ${pageStart + 23}`);

  const navButton = (side: 'previous' | 'next', { enabled, extra }: { enabled: boolean; extra?: string }) => {
    const attributes = [
      extra,
      `class="et-calendar-nav-button et-calendar-nav-button--${side} et-icon-button et-color-interactive et-focus-ring et-color--inherited"`,
      'type="button"',
      `aria-label="${side === 'previous' ? 'Previous' : 'Next'}"`,
      !enabled && 'disabled',
      'data-variant="transparent"',
      'data-size="sm"',
    ].filter(Boolean);

    return `<button ${attributes.join(' ')}><div class="et-icon-button-icon">${iconMarkup(CHEVRON_ICON)}</div></button>`;
  };

  const label = [
    options.labelAttributes,
    'class="et-calendar-header-label"',
    'type="button"',
    `aria-label="${view === 'multiYear' ? 'Choose date' : 'Choose year'}"`,
  ].filter(Boolean);

  const header = `<div class="et-calendar-header">${navButton('previous', { enabled: canGoPrev, extra: options.previousAttributes })}<button ${label.join(' ')}><span class="et-calendar-header-label-text" aria-live="polite"><span class="et-calendar-header-label-value">${headerLabel}</span></span>${iconMarkup(CHEVRON_ICON, 'et-calendar-header-label-icon')}</button>${navButton('next', { enabled: canGoNext, extra: options.nextAttributes })}</div>`;

  const grid = view === 'month' ? monthGrid() : view === 'year' ? yearGrid() : multiYearGrid();
  const body = `<div class="et-calendar-grid">${view === 'month' ? weekdays() : ''}<div class="et-calendar-weeks-viewport" role="presentation"><div class="et-calendar-weeks" role="rowgroup">${grid}</div></div></div>`;

  const host = [
    options.attributes,
    'class="et-calendar"',
    `data-view="${view}"`,
    options.weekNumbers && 'data-week-numbers=""',
  ].filter(Boolean);

  return `<div ${host.join(' ')}>${header}${body}</div>`;
};
