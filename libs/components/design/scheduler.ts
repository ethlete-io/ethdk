import iconButtonBase from '../src/lib/button/icon-button.component.css?inline';
import segmentedButtonGroupBase from '../src/lib/forms/selection-list/segmented-button-group/segmented-button-group.component.css?inline';
import segmentedButtonBase from '../src/lib/forms/selection-list/segmented-button-group/segmented-button.component.css?inline';
import { CALENDAR_ICON } from '../src/lib/icon/headless/calendar-icon';
import { CHEVRON_ICON } from '../src/lib/icon/headless/chevron-icon';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import { LOCATION_ICON } from '../src/lib/icon/headless/location-icon';
import { PLUS_ICON } from '../src/lib/icon/headless/plus-icon';
import agendaViewBase from '../src/lib/scheduler/scheduler-agenda-view.component.css?inline';
import appointmentDragBase from '../src/lib/scheduler/scheduler-appointment-drag-styles.component.css?inline';
import appointmentBase from '../src/lib/scheduler/scheduler-appointment-styles.component.css?inline';
import monthViewBase from '../src/lib/scheduler/scheduler-month-view.component.css?inline';
import timeGridViewBase from '../src/lib/scheduler/scheduler-time-grid-view.component.css?inline';
import schedulerBase from '../src/lib/scheduler/scheduler.component.css?inline';
import tabScale from '../src/lib/tabs/tab-scale-styles.component.css?inline';
import { buttonStyles } from './button';
import { iconMarkup } from './icon';

export type SchedulerMockView = 'month' | 'week' | 'day' | 'agenda';

export type SchedulerMockAppointment = {
  title: string;
  /** A color theme name the app registers. Left out, the appointment takes the color theme around the scheduler. */
  color?: string;
  /** The time range badge text. Left out, no time range badge (an all-day appointment). */
  timeRange?: string;
  location?: string;
  /** The number of nested appointments, drawn by the chain count badge. */
  chainCount?: number;
  selected?: boolean;
  dragging?: boolean;
  /** A design marker on the appointment button, e.g. `hover` or `focus-visible`. */
  force?: string;
};

export type SchedulerMockDay = {
  weekday: string;
  date: number;
  /** The full day label the grid cells announce, e.g. `Monday, March 2`. */
  label: string;
  today?: boolean;
};

export type SchedulerMockTimeBlock = SchedulerMockAppointment & {
  /** The column index in the view. */
  day: number;
  /** Start and end in hours, e.g. 9.5 for 9:30. */
  start: number;
  end: number;
  /** Inline offset and size in percent of the column, for overlapping appointments. */
  inlineOffset?: number;
  inlineSize?: number;
  /** The nesting depth below a parent appointment. */
  depth?: number;
};

export type SchedulerMockAllDayEntry = SchedulerMockAppointment & {
  day: number;
  /** The number of days the entry spans. */
  span: number;
  row?: number;
};

export type SchedulerMockTimeGridOptions = {
  days: readonly SchedulerMockDay[];
  /** The first and last hour drawn, as if the scrolling body sat on that window. */
  fromHour: number;
  toHour: number;
  hourLabel: (hour: number) => string;
  blocks?: readonly SchedulerMockTimeBlock[];
  allDay?: readonly SchedulerMockAllDayEntry[];
  /** The current time line: the column and the time in hours. */
  now?: { day: number; time: number };
  /** Non-business time per column, in hours. */
  nonBusiness?: readonly { day: number; from: number; to: number }[];
  /** A design marker on one slot, e.g. `focus-visible`. */
  forcedSlot?: { day: number; hour: number; force: string };
  ariaLabel: string;
};

export type SchedulerMockMonthCell = {
  date: number;
  label: string;
  outsideMonth?: boolean;
  today?: boolean;
  appointments?: readonly SchedulerMockAppointment[];
  /** The number of appointments behind the `+n more` trigger. */
  overflow?: number;
  force?: string;
};

export type SchedulerMockMonthOptions = {
  weekdays: readonly { short: string; long: string }[];
  weeks: readonly (readonly SchedulerMockMonthCell[])[];
  ariaLabel: string;
};

export type SchedulerMockAgendaRow = SchedulerMockAppointment & {
  /** The tree guides in front of a nested appointment. */
  guides?: readonly ('trunk' | 'branch' | 'last-branch' | 'blank')[];
};

export type SchedulerMockAgendaOptions = {
  days: readonly (SchedulerMockDay & { month?: string; rows: readonly SchedulerMockAgendaRow[] })[];
};

export type SchedulerMockLabels = {
  today: string;
  previous: string;
  next: string;
  addAppointment: string;
  views: Record<SchedulerMockView, string>;
};

export type SchedulerMockOptions = {
  view: SchedulerMockView;
  headerLabel: string;
  /** The rendered view, from `schedulerTimeGrid()`, `schedulerMonth()` or `schedulerAgenda()`. */
  body: string;
  labels?: SchedulerMockLabels;
  /** Draws the add appointment toolbar action. */
  addAction?: boolean;
  /** Extra attributes on the host, e.g. a style or design markers. */
  attributes?: string;
};

const DEFAULT_LABELS: SchedulerMockLabels = {
  today: 'Today',
  previous: 'Previous',
  next: 'Next',
  addAppointment: 'Add appointment',
  views: { month: 'Month', week: 'Week', day: 'Day', agenda: 'Agenda' },
};

/** The stylesheets the scheduler mocks draw with: the real scheduler, view, appointment, button, icon and segmented button CSS. */
export const schedulerStyles = /* @__PURE__ */ [
  buttonStyles,
  iconBase,
  iconButtonBase,
  tabScale,
  segmentedButtonGroupBase,
  segmentedButtonBase,
  schedulerBase,
  appointmentBase,
  appointmentDragBase,
  timeGridViewBase,
  monthViewBase,
  agendaViewBase,
].join('\n');

const styled = (css: string) => ` style="${css}"`;

const flag = (on: boolean | undefined, name: string) => (on ? ` ${name}=""` : '');

const forced = (force: string | undefined) => (force ? ` data-et-force="${force}"` : '');

const colored = (color: string | undefined) => (color ? ` et-color--${color}` : '');

const badges = (appointment: SchedulerMockAppointment) => {
  const timeRange = appointment.timeRange
    ? `<span class="et-scheduler-appointment-time-range">${appointment.timeRange}</span>`
    : '';
  const location = appointment.location
    ? `<span class="et-scheduler-appointment-location">${iconMarkup(LOCATION_ICON, 'et-scheduler-appointment-location-icon')}<span class="et-scheduler-appointment-location-text">${appointment.location}</span></span>`
    : '';
  const chainCount = appointment.chainCount
    ? `<span class="et-scheduler-appointment-chain-count">${iconMarkup(CHEVRON_ICON, 'et-scheduler-appointment-chain-count-icon')}${appointment.chainCount}</span>`
    : '';

  return [
    `<et-scheduler-badge-color-dot><span aria-hidden="true" class="et-scheduler-appointment-dot"></span></et-scheduler-badge-color-dot>`,
    `<et-scheduler-badge-title><span class="et-scheduler-appointment-title">${appointment.title}</span></et-scheduler-badge-title>`,
    `<et-scheduler-badge-time-range>${timeRange}</et-scheduler-badge-time-range>`,
    `<et-scheduler-badge-location>${location}</et-scheduler-badge-location>`,
    `<et-scheduler-badge-chain-count>${chainCount}</et-scheduler-badge-chain-count>`,
  ].join('');
};

const appointmentAttributes = (appointment: SchedulerMockAppointment) =>
  [
    flag(appointment.selected, 'data-selected'),
    ' data-draggable=""',
    flag(appointment.dragging, 'data-dragging'),
    ` title="${appointment.title}"`,
    forced(appointment.force),
  ].join('');

const resizeHandles = (className: string) =>
  `<span data-edge="start" aria-hidden="true" class="${className}"></span><span data-edge="end" aria-hidden="true" class="${className}"></span>`;

const percent = (hours: number, options: SchedulerMockTimeGridOptions) =>
  ((hours - options.fromHour) / (options.toHour - options.fromHour)) * 100;

/** Draws an `et-scheduler-time-grid-view` (the week or day grid) with its all-day lane, blocks and current time line, as HTML. */
export const schedulerTimeGrid = (options: SchedulerMockTimeGridOptions) => {
  const hours = Array.from({ length: options.toHour - options.fromHour }, (_, index) => options.fromHour + index);
  const allDay = options.allDay ?? [];
  const allDayRows = allDay.length ? Math.max(...allDay.map((entry) => (entry.row ?? 0) + 1)) : 0;

  const header = options.days
    .map(
      (day) =>
        `<div role="columnheader" class="et-scheduler-time-grid-header-day"${flag(day.today, 'data-today')}><span class="et-scheduler-time-grid-header-weekday">${day.weekday}</span><span class="et-scheduler-time-grid-header-date">${day.date}</span></div>`,
    )
    .join('');

  const allDayLane = allDayRows
    ? `<div role="row" class="et-scheduler-time-grid-row et-scheduler-time-grid-all-day"><div role="presentation" class="et-scheduler-time-grid-gutter"></div><div role="presentation" class="et-scheduler-time-grid-all-day-lane"${styled(`--_et-scheduler-time-grid-all-day-row-count: ${allDayRows}`)}>${options.days
        .map((day, dayIndex) => {
          const entries = allDay
            .filter((entry) => entry.day === dayIndex)
            .map(
              (entry) =>
                `<button type="button" tabindex="-1" class="et-scheduler-appointment et-scheduler-time-grid-all-day-entry${colored(entry.color)}"${appointmentAttributes(entry)}${styled(`--_et-scheduler-time-grid-all-day-offset: ${(dayIndex / options.days.length) * 100}; --_et-scheduler-time-grid-all-day-size: ${(entry.span / options.days.length) * 100}; --_et-scheduler-time-grid-all-day-row: ${entry.row ?? 0}`)}>${badges(entry)}${resizeHandles('et-scheduler-time-grid-all-day-resize')}</button>`,
            )
            .join('');

          return `<div role="gridcell" class="et-scheduler-time-grid-all-day-cell" aria-label="${day.label}, All day" tabindex="-1">${entries}</div>`;
        })
        .join('')}</div></div>`
    : '';

  const gutter = hours
    .map(
      (hour) =>
        `<div class="et-scheduler-time-grid-hour-row"><span class="et-scheduler-time-grid-hour-label">${options.hourLabel(hour)}</span></div>`,
    )
    .join('');

  const columns = options.days
    .map((day, dayIndex) => {
      const nonBusiness = (options.nonBusiness ?? [])
        .filter((segment) => segment.day === dayIndex)
        .map(
          (segment) =>
            `<div role="presentation" class="et-scheduler-time-grid-non-business"${styled(`--_et-scheduler-time-grid-block-offset: ${percent(segment.from, options)}; --_et-scheduler-time-grid-block-span: ${percent(segment.to, options) - percent(segment.from, options)}`)}></div>`,
        )
        .join('');
      const now =
        options.now?.day === dayIndex
          ? `<div role="presentation" class="et-scheduler-time-grid-now"${styled(`--_et-scheduler-time-grid-now-offset: ${percent(options.now.time, options)}`)}></div>`
          : '';
      const slots = hours
        .map((hour) => {
          const blocks = (options.blocks ?? [])
            .filter((block) => block.day === dayIndex && Math.floor(block.start) === hour)
            .map((block) => {
              const depth = block.depth ?? 0;

              return `<button type="button" tabindex="-1" class="et-scheduler-time-grid-block${colored(block.color)}"${appointmentAttributes(block)}${flag(depth > 0, 'data-nested')}${styled(`--_et-scheduler-time-grid-block-offset: ${percent(block.start, options)}; --_et-scheduler-time-grid-block-span: ${percent(block.end, options) - percent(block.start, options)}; --_et-scheduler-time-grid-block-inline-offset: ${block.inlineOffset ?? 0}; --_et-scheduler-time-grid-block-inline-size: ${block.inlineSize ?? 100}; --_et-scheduler-time-grid-block-depth: ${depth}`)}>${badges(block)}${resizeHandles('et-scheduler-time-grid-block-resize')}</button>`;
            })
            .join('');
          const slotForce =
            options.forcedSlot?.day === dayIndex && options.forcedSlot.hour === hour
              ? forced(options.forcedSlot.force)
              : '';

          return `<div role="gridcell" class="et-scheduler-time-grid-hour-row et-scheduler-time-grid-slot" aria-label="${day.label}, ${options.hourLabel(hour)}" tabindex="-1"${slotForce}>${blocks}</div>`;
        })
        .join('');

      return `<div role="presentation" class="et-scheduler-time-grid-day"${flag(day.today, 'data-today')}>${nonBusiness}${now}${slots}</div>`;
    })
    .join('');

  return [
    `<et-scheduler-time-grid-view role="grid" class="et-scheduler-time-grid-view" aria-label="${options.ariaLabel}">`,
    `<div role="row" class="et-scheduler-time-grid-row et-scheduler-time-grid-header"><div role="presentation" class="et-scheduler-time-grid-gutter"></div><div role="presentation" class="et-scheduler-time-grid-days">${header}</div></div>`,
    allDayLane,
    `<div role="presentation" class="et-scheduler-time-grid-body-wrap"><div role="rowgroup" class="et-scheduler-time-grid-row et-scheduler-time-grid-body et-scrollbar-host">`,
    `<div role="presentation" class="et-scheduler-time-grid-gutter">${gutter}</div>`,
    `<div role="presentation" class="et-scheduler-time-grid-days">${columns}</div>`,
    `</div></div></et-scheduler-time-grid-view>`,
  ].join('');
};

/** Draws an `et-scheduler-month-view` grid with its appointments and `+n more` triggers, as HTML. */
export const schedulerMonth = (options: SchedulerMockMonthOptions) => {
  const weekdays = options.weekdays
    .map(
      (weekday) =>
        `<span aria-label="${weekday.long}" role="columnheader" class="et-scheduler-month-view-weekday">${weekday.short}</span>`,
    )
    .join('');

  const weeks = options.weeks
    .map((week) => {
      const cells = week
        .map((cell) => {
          const appointments = (cell.appointments ?? [])
            .map(
              (appointment) =>
                `<button type="button" tabindex="-1" class="et-scheduler-appointment${colored(appointment.color)}"${appointmentAttributes(appointment)}>${badges(appointment)}</button>`,
            )
            .join('');
          const overflow = cell.overflow
            ? `<div class="et-scheduler-month-view-overflow"><button aria-haspopup="menu" type="button" tabindex="-1" class="et-scheduler-month-view-overflow-trigger" aria-expanded="false">+${cell.overflow} more</button></div>`
            : '';

          return `<div role="gridcell" class="et-scheduler-month-view-cell"${flag(cell.outsideMonth, 'data-outside-month')}${flag(cell.today, 'data-today')}${cell.today ? ' aria-current="date"' : ''} aria-label="${cell.label}" tabindex="-1"${forced(cell.force)}><span aria-hidden="true" class="et-scheduler-month-view-cell-date">${cell.date}</span><div class="et-scheduler-month-view-cell-appointments">${appointments}${overflow}</div></div>`;
        })
        .join('');

      return `<div role="row" class="et-scheduler-month-view-week">${cells}</div>`;
    })
    .join('');

  return `<et-scheduler-month-view role="grid" class="et-scheduler-month-view" aria-label="${options.ariaLabel}"><div role="row" class="et-scheduler-month-view-weekdays">${weekdays}</div><div role="rowgroup" class="et-scheduler-month-view-weeks"><div aria-hidden="true" class="et-scheduler-month-view-draft-anchor"></div>${weeks}</div></et-scheduler-month-view>`;
};

/** Draws an `et-scheduler-agenda-view` list of days with their appointments and tree guides, as HTML. */
export const schedulerAgenda = (options: SchedulerMockAgendaOptions) => {
  const days = options.days
    .map((day) => {
      const month = day.month ? `<h3 class="et-scheduler-agenda-view-month">${day.month}</h3>` : '';
      const rows = day.rows
        .map((row) => {
          const guides = (row.guides ?? [])
            .map(
              (guide) =>
                `<span aria-hidden="true" class="et-scheduler-agenda-view-guide" data-guide="${guide}"></span>`,
            )
            .join('');

          return `<div class="et-scheduler-agenda-view-appointment">${guides}<button type="button" class="et-scheduler-appointment${colored(row.color)}"${flag(row.selected, 'data-selected')}${flag(guides.length > 0, 'data-nested')}${forced(row.force)}>${badges(row)}</button></div>`;
        })
        .join('');

      return `${month}<div class="et-scheduler-agenda-view-day"><div class="et-scheduler-agenda-view-day-header"${flag(day.today, 'data-today')}><span class="et-scheduler-agenda-view-day-weekday">${day.weekday}</span><span class="et-scheduler-agenda-view-day-date">${day.date}</span></div><div class="et-scheduler-agenda-view-day-appointments">${rows}</div></div>`;
    })
    .join('');

  return `<et-scheduler-agenda-view class="et-scheduler-agenda-view"><div class="et-scheduler-agenda-view-scroller et-scrollbar-host">${days}</div></et-scheduler-agenda-view>`;
};

const BUTTON_CLASSES = 'et-surface-interactive et-color-interactive';

/**
 * Draws an `et-scheduler` with its wide header (today button, toolbar action, previous and next, the range label
 * and the view switch) around a view, as HTML. The visually hidden view switch label and the auto-hiding
 * scrollbar are left out.
 */
export const scheduler = (options: SchedulerMockOptions) => {
  const labels = options.labels ?? DEFAULT_LABELS;

  const today = `<button type="button" class="${BUTTON_CLASSES} et-button et-scheduler-today-button et-focus-ring et-color--inherited" aria-label="${labels.today}" data-icon-alignment="start" data-variant="outline" data-size="sm"><div class="et-button-icon">${iconMarkup(CALENDAR_ICON)}</div><div class="et-button-contents"><span class="et-scheduler-today-button-label">${labels.today}</span></div></button>`;
  const add = options.addAction
    ? `<button type="button" class="${BUTTON_CLASSES} et-button et-scheduler-toolbar-action et-focus-ring et-color--inherited" data-icon-alignment="start" data-variant="filled" data-size="sm"><div class="et-button-icon">${iconMarkup(PLUS_ICON)}</div><div class="et-button-contents">${labels.addAppointment}</div></button>`
    : '';
  const navButton = (direction: 'previous' | 'next') =>
    `<button type="button" class="${BUTTON_CLASSES} et-icon-button et-scheduler-nav-button et-scheduler-nav-button--${direction} et-focus-ring et-color--inherited" aria-label="${labels[direction]}" data-variant="transparent" data-size="sm"><div class="et-icon-button-icon">${iconMarkup(CHEVRON_ICON)}</div></button>`;
  const views = (['month', 'week', 'day', 'agenda'] as const)
    .map((view) => {
      const checked = view === options.view;

      return `<et-segmented-button value="${view}" class="et-color-interactive et-segmented-button" role="radio" aria-checked="${checked}" tabindex="${checked ? 0 : -1}"><div class="et-segmented-button-bg"></div><span class="et-segmented-button-label">${labels.views[view]}</span></et-segmented-button>`;
    })
    .join('');

  return [
    `<et-scheduler class="et-scheduler" ${options.attributes ?? ''}><div class="et-scheduler-header">`,
    today,
    add,
    `<div class="et-scheduler-nav-buttons">${navButton('previous')}${navButton('next')}</div>`,
    `<span class="et-scheduler-header-label">${options.headerLabel}</span><div class="et-scheduler-header-spacer"></div>`,
    `<et-segmented-button-group class="et-segmented-button-group et-scheduler-view-switch et-color--inherited et-tab-scale" role="radiogroup" data-size="sm" data-variant="tabs"><div class="et-segmented-button-group-buttons">${views}</div></et-segmented-button-group>`,
    `</div><div class="et-scheduler-body">${options.body}</div></et-scheduler>`,
  ].join('');
};
