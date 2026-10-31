import {
  scheduler,
  schedulerAgenda,
  SchedulerMockAppointment,
  SchedulerMockDay,
  SchedulerMockMonthCell,
  SchedulerMockTimeBlock,
  SchedulerMockView,
  schedulerMonth,
  schedulerStyles,
  schedulerTimeGrid,
} from '@ethlete/components/design/scheduler';
import { definePart, drawing } from '@design-system';
import frame from './scheduler.css?inline';

type Interaction = 'hover' | 'focus-visible';

type Props = {
  view: SchedulerMockView;
  appointment?: Interaction;
  slot?: Interaction;
  cell?: Interaction;
  dragging?: boolean;
};

const clock = (time: number) => {
  const hour = Math.floor(time);
  const minutes = String(Math.round((time - hour) * 60)).padStart(2, '0');

  return `${hour % 12 || 12}:${minutes} ${hour < 12 ? 'AM' : 'PM'}`;
};

const range = (start: number, end: number) => `${clock(start)}–${clock(end)}`;

const WED: SchedulerMockDay = { weekday: 'Wed', date: 4, label: 'Wednesday, March 4th, 2026', today: true };
const THU: SchedulerMockDay = { weekday: 'Thu', date: 5, label: 'Thursday, March 5th, 2026' };
const FRI: SchedulerMockDay = { weekday: 'Fri', date: 6, label: 'Friday, March 6th, 2026' };

const WEEK: SchedulerMockDay[] = [
  { weekday: 'Mon', date: 2, label: 'Monday, March 2nd, 2026' },
  { weekday: 'Tue', date: 3, label: 'Tuesday, March 3rd, 2026' },
  WED,
  THU,
  FRI,
  { weekday: 'Sat', date: 7, label: 'Saturday, March 7th, 2026' },
  { weekday: 'Sun', date: 8, label: 'Sunday, March 8th, 2026' },
];

const TODAY = 2;

const block = (
  day: number,
  start: number,
  end: number,
  appointment: SchedulerMockAppointment,
  extra: Partial<SchedulerMockTimeBlock> = {},
): SchedulerMockTimeBlock => ({ day, start, end, timeRange: range(start, end), ...appointment, ...extra });

const weekBlocks = (props: Props): SchedulerMockTimeBlock[] => [
  block(0, 9, 9.5, { title: 'Daily sync', force: props.appointment }),
  block(1, 9, 9.5, { title: 'Daily sync' }),
  block(
    1,
    10,
    12,
    { title: 'Roadmap planning', color: 'warning', location: 'Room 2', chainCount: 1 },
    { inlineOffset: 50, inlineSize: 50 },
  ),
  block(1, 10.5, 11.5, { title: 'Budget check', color: 'warning' }, { inlineOffset: 0, inlineSize: 50, depth: 1 }),
  block(TODAY, 9, 9.5, { title: 'Daily sync' }),
  block(TODAY, 13, 14.5, { title: 'Design review', location: 'Studio A', selected: true }),
  block(3, 9, 9.5, { title: 'Daily sync' }),
  block(3, 14, 16, { title: 'Hiring panel', color: 'danger', location: 'Room 4' }),
  block(4, 9, 9.5, { title: 'Daily sync' }),
  block(4, props.dragging ? 15.5 : 15, props.dragging ? 16.5 : 16, { title: 'Retro', dragging: props.dragging }),
];

const weekNonBusiness = WEEK.flatMap((_, day) =>
  day >= 5
    ? [{ day, from: 8, to: 18 }]
    : [
        { day, from: 8, to: 9 },
        { day, from: 17, to: 18 },
      ],
);

const timeGrid = (props: Props) => {
  const single = props.view === 'day';
  const days = single ? [WED] : WEEK;
  const pick = (day: number) => (single ? (day === TODAY ? 0 : -1) : day);
  const blocks = weekBlocks(props)
    .map((entry) => ({ ...entry, day: pick(entry.day) }))
    .filter((entry) => entry.day >= 0);

  return schedulerTimeGrid({
    days,
    fromHour: 8,
    toHour: 18,
    hourLabel: (hour) => clock(hour),
    blocks,
    allDay: single ? [] : [{ day: 3, span: 2, title: 'Conference', color: 'danger' }],
    now: { day: pick(TODAY), time: 11.25 },
    nonBusiness: weekNonBusiness
      .map((segment) => ({ ...segment, day: pick(segment.day) }))
      .filter((segment) => segment.day >= 0),
    forcedSlot: props.slot ? { day: single ? 0 : 3, hour: 11, force: props.slot } : undefined,
    ariaLabel: single ? 'Wednesday, March 4, 2026' : 'March 2 – 8, 2026',
  });
};

const MONTH_APPOINTMENTS: Record<number, SchedulerMockAppointment[]> = {
  2: [{ title: 'Daily sync', timeRange: range(9, 9.5) }],
  3: [
    { title: 'Daily sync', timeRange: range(9, 9.5) },
    { title: 'Roadmap planning', timeRange: range(10, 12) },
  ],
  4: [
    { title: 'Daily sync', timeRange: range(9, 9.5) },
    { title: 'Design review', timeRange: range(13, 14.5), selected: true },
  ],
  5: [{ title: 'Conference', color: 'danger' }],
  6: [{ title: 'Conference', color: 'danger' }],
  12: [{ title: 'Quarterly review', timeRange: range(14, 16) }],
  17: [
    { title: 'Daily sync', timeRange: range(9, 9.5) },
    { title: 'Workshop', color: 'warning', timeRange: range(10, 13) },
  ],
  25: [{ title: 'Release', color: 'danger' }],
};

const monthCell = (date: number, outsideMonth: boolean, props: Props): SchedulerMockMonthCell => {
  const appointments = outsideMonth ? [] : (MONTH_APPOINTMENTS[date] ?? []);

  return {
    date,
    label: date === 4 && !outsideMonth ? 'Wednesday, March 4th, 2026' : `${date}`,
    outsideMonth,
    today: !outsideMonth && date === 4,
    appointments: (date === 3 && !outsideMonth ? appointments.slice(0, 2) : appointments).map((appointment) =>
      date === 2 && !outsideMonth ? { ...appointment, force: props.appointment } : appointment,
    ),
    overflow: date === 17 && !outsideMonth ? 3 : undefined,
    force: date === 19 && !outsideMonth ? props.cell : undefined,
  };
};

const month = (props: Props) => {
  const dates = [23, 24, 25, 26, 27, 28, ...Array.from({ length: 31 }, (_, index) => index + 1), 1, 2, 3, 4, 5];
  const weeks = Array.from({ length: 6 }, (_, week) =>
    dates.slice(week * 7, week * 7 + 7).map((date, index) => {
      const position = week * 7 + index;

      return monthCell(date, position < 6 || position > 36, props);
    }),
  );

  return schedulerMonth({
    weekdays: WEEK.map((day) => ({ short: day.weekday, long: day.label.split(',')[0] ?? day.weekday })),
    weeks,
    ariaLabel: 'March 2026',
  });
};

const agenda = (props: Props) =>
  schedulerAgenda({
    days: [
      {
        ...WED,
        month: 'March 2026',
        rows: [
          { title: 'Daily sync', timeRange: range(9, 9.5), force: props.appointment },
          {
            title: 'Design review',
            timeRange: range(13, 14.5),
            location: 'Studio A',
            selected: true,
          },
        ],
      },
      {
        ...THU,
        rows: [
          { title: 'Conference', color: 'danger' },
          { title: 'Daily sync', timeRange: range(9, 9.5) },
          { title: 'Hiring panel', color: 'danger', timeRange: range(14, 16), location: 'Room 4', chainCount: 2 },
          { title: 'Intro call', color: 'danger', timeRange: range(14, 14.5), guides: ['branch'] },
          { title: 'Debrief', color: 'danger', timeRange: range(15.5, 16), guides: ['last-branch'] },
        ],
      },
      {
        ...FRI,
        rows: [
          { title: 'Conference', color: 'danger' },
          { title: 'Retro', timeRange: range(15, 16) },
        ],
      },
    ],
  });

const HEADER_LABELS: Record<SchedulerMockView, string> = {
  week: 'March 2 – 8, 2026',
  day: 'Wednesday, March 4, 2026',
  month: 'March 2026',
  agenda: 'March 4 – 10, 2026',
};

const render = (props: Props) => {
  const body = props.view === 'month' ? month(props) : props.view === 'agenda' ? agenda(props) : timeGrid(props);

  return scheduler({ view: props.view, headerLabel: HEADER_LABELS[props.view], addAction: true, body });
};

const skipClipped = (markup: string) =>
  markup.replaceAll(
    'class="et-scheduler-time-grid-block',
    'data-et-skip="CLIPPED" class="et-scheduler-time-grid-block',
  );

export default definePart({
  note: "The SDK scheduler (et-scheduler) in flow, first drawing, drawn by the mock from @ethlete/components/design/scheduler with the real markup and CSS: the wide header (outline Today button, filled Add appointment, previous and next icon buttons, the range label, the tabs view switch), et-scheduler-time-grid-view (week and day), et-scheduler-month-view and et-scheduler-agenda-view, the appointment badges (color dot, title, time range, location, chain count) and the resize handles; default labels, en-US times. Fixtures are fictional: one week (Mon March 2 to Sun March 8, 2026, today Wed March 4) with a daily sync, an overlapping parent and nested child (Roadmap planning / Budget check), a selected appointment (Design review, brand), a two-day all-day Conference, Hiring panel and Retro; the colors are the sdk product's registered themes brand (default), warning and danger. The time grid draws 8:00 to 18:00 as if the scrolling body sat on that window, with business hours 9 to 17 on weekdays and the weekend outside them; the current time line sits on today at 11:15. Framed as a page with 16px padding. Widths 560, 800 and 1200 (all above the 480px container width where the header switches to floating action buttons). States: week, week-dragging (Retro lifted, with the drag shadow), appointment-hover, appointment-focus-visible (Daily sync on Monday forced), slot-focus-visible (Thursday 11:00 forced), day, month (outside-month days, today, a +3 more trigger, the selected appointment), month-cell-focus-visible, agenda (a month heading, today, nested rows with tree guides, the selected appointment). Numbers (light / dark), from shot pixels at scale 2 at 800, brand mint, a: appointment tint (14 %) vs page 1.07 / 1.37, its title ink on it 5.12 / 9.84; selected appointment (mint fill) vs page 1.33 / 13.50, its text 15.82 / 15.82; today date circle (mint fill) vs page 1.33 / 13.50, its digit 15.82; current time line and its dot vs the today column 1.29 / 12.14; focus ring (primary) vs page 1.35 / 13.50, vs the appointment tint 1.26 / 9.84; Add appointment fill vs page 1.33 / 13.50, its label 15.82. Q98 numbers only: grid lines (hour rows, day columns, header and all-day edges, month cells) vs page 1.26 / 1.73; the non-business band 1.07 / 1.08; the today column tint is 6 % mint. Decided rules that arise: Q88 (every focus ring: slots, all-day cells, month cells, appointments, the overflow trigger, the view switch, the header buttons), Q99a (the current time line and its dot, the appointment color dot; the selected appointment, the today date circles and the filled Add appointment button are mint fills, so they take a 1px inset ink edge) and Q101 (the filled button hover = -active). The ink edge on a mint fill arises, so Q102 arises: b draws the edges in both schemes, c keeps dark as today (light-dark(ink, transparent)). The 32 / 38 / 44 % selection step does not arise: a selected appointment is a solid mint fill, not a tint. Findings for later: (1) lib bug: the badge pieces render inside their component hosts (et-scheduler-badge-color-dot, -title, -time-range, -location, -chain-count), which are inline, so the flex rules on the inner spans never apply: the color dot is 0 x 0 and never shows (also in Storybook), the title does not take flex: 1 or ellipsis, and the time range and location are cut hard at the block edge (the agenda location shrinks to one letter while the title has room). Fixed in the lib (display: contents on the five hosts; the time range and location shrink with an ellipsis before the title). Narrow week blocks still clip, because the gaps, the dot and the chain count alone are wider than the block (31 px at 560), so data-et-skip CLIPPED stays on every time grid block; the month cell skip is gone. (2) The first hour label sat half above the scroll body (translateY(-50%)) and was clipped by its overflow; fixed in the lib with a top padding of half the label line height. (3) Outside-month dates read nearly like in-month ones. (4) The selected appointment edge and the drag shadow share box-shadow, so a selected appointment being dragged would lose one (not drawn); the lib has no selected edge yet, so whoever merges b or c must list the edge and the drag shadow in one rule on [data-selected][data-dragging]. (5) The Add appointment hover (Q101) is not forced here; it is the same et-button as in the stream round (hover 1.69 from rest). Later rounds, left out here: the edit surface (scheduler-edit-surface and its parts, an overlay), the month +n more menu, the narrow header with floating action buttons, the drag-to-create draft and committed blocks, month draft and drop-target cells, the scrollbar, custom badge adornments, the read-only scheduler, RTL and long labels.",
  madeBy: ['claude-opus-5-5'],
  states: {
    week: { view: 'week' },
    'week-dragging': { view: 'week', dragging: true },
    'appointment-hover': { view: 'week', appointment: 'hover' },
    'appointment-focus-visible': { view: 'week', appointment: 'focus-visible' },
    'slot-focus-visible': { view: 'week', slot: 'focus-visible' },
    day: { view: 'day' },
    month: { view: 'month' },
    'month-cell-focus-visible': { view: 'month', cell: 'focus-visible' },
    agenda: { view: 'agenda' },
  },
  widths: [560, 800, 1200],
  frame: (body) => `<div class="t-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: skipClipped(render(props)),
      styles: [schedulerStyles, frame].join('\n'),
    }),
});
