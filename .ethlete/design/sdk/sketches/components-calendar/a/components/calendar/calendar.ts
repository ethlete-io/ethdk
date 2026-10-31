import { calendar, calendarStyles, CalendarMockOptions } from '@ethlete/components/design/calendar';
import { definePart, drawing } from '@design-system';
import frame from './calendar.css?inline';

type Interaction = 'hover' | 'focus-visible';

type Props = {
  view?: CalendarMockOptions['view'];
  selected?: boolean;
  range?: boolean;
  day?: Interaction;
  selectedDay?: Interaction;
  rangeDay?: Interaction;
  disabled?: boolean;
  limits?: boolean;
  weekNumbers?: boolean;
  comparison?: boolean;
  nav?: Interaction;
  label?: Interaction;
  compact?: boolean;
};

const TODAY = '2026-09-14';

const force = (interaction: Interaction | undefined, key: string) =>
  interaction ? { [key]: `data-et-force="${interaction}"` } : {};

const render = (props: Props) => {
  const view = props.view ?? 'month';
  const coarseKey = view === 'year' ? '2026-03' : '2021';

  return calendar({
    view,
    month: '2026-09',
    today: TODAY,
    value: props.selected
      ? view === 'year'
        ? '2026-05-20'
        : view === 'multiYear'
          ? '2024-05-20'
          : '2026-09-17'
      : undefined,
    range: props.range
      ? { start: '2026-09-09', end: '2026-09-16' }
      : props.comparison
        ? { start: '2026-09-15', end: '2026-09-18' }
        : undefined,
    comparison: props.comparison ? { start: '2026-09-07', end: '2026-09-11' } : undefined,
    min: props.limits ? '2026-09-07' : undefined,
    max: props.limits ? '2026-09-24' : undefined,
    disabled: props.disabled ? ['2026-09-05', '2026-09-06', '2026-09-26', '2026-09-27'] : undefined,
    weekNumbers: props.weekNumbers,
    cellAttributes: {
      ...force(props.day, view === 'month' ? '2026-09-22' : coarseKey),
      ...force(props.selectedDay, '2026-09-17'),
      ...force(props.rangeDay, '2026-09-09'),
    },
    nextAttributes: props.nav ? `data-et-force="${props.nav}"` : undefined,
    labelAttributes: props.label ? `data-et-force="${props.label}"` : undefined,
    attributes: props.compact ? 'style="--et-calendar-cell-size: 32px"' : undefined,
  });
};

export default definePart({
  note: 'The SDK inline calendar (et-calendar), first drawing, drawn by its mock from @ethlete/components/design/calendar with its real markup and CSS: calendar.component.css plus the coarse grid, comparison band and week number sheets, and the icon-button and icon CSS for the header. No picker overlay. Framed as a 480px page with 16px padding; fixed dates: today is Mon 14 Sep 2026, the month is September 2026, Monday first, no locale (ISO week numbers, en-US labels). States: rest (today ring on 14, the outside days Aug 31 and Oct 1-4 in muted), selected (17), selected-hover, selected-focus-visible, range (9 to 16, across the week break, today inside the band), range-focus-visible (on the start edge), day-hover and day-focus-visible (on 22), disabled (a date filter turning down 5, 6, 26, 27), limits (min 7 Sep, max 24 Sep: days outside are disabled, both nav buttons disabled), week-numbers, comparison (range 15 to 18 over a comparison band 7 to 11), year-view (May selected, Sep today), year-view-hover and year-view-focus-visible (on Mar), multi-year-view (2016 to 2039, 2024 selected, 2026 today), nav-hover and nav-focus-visible (next button), label-hover and label-focus-visible (the zoom label), long-label (September 2026, the longest English month, at --et-calendar-cell-size 32px: 224px wide, the label and its chevron nearly touch but do not overlap). Static snapshot: the slide and fade of the weeks and the label only run on navigation and are drawn at rest; the multi-month layout is left out. Numbers (light / dark), from shot pixels at scale 2, brand mint, a: day text 17.93 / 17.18; header label 17.93 / 17.18; weekdays, outside-month days and week numbers (muted) 7.81 / 6.94; disabled days (subtle, struck) 4.95 / 4.99; today ring (1px ink) 5.48 / 13.50; nav chevrons (ink) 5.48 / 13.50; selected fill vs page 1.33 / 13.50, its label 15.82 / 15.82; range band (12 %) vs page 1.06 / 1.31, text on it 16.89 / 13.12; hover tint vs page 1.16 / 1.22; focus rings (primary, 2px): day 1.33 / 13.50, header label 1.33 / 13.50, nav 1.37 / 13.06; comparison bar (muted) 7.81 / 6.94. Q98 (week column edge vs page) numbers only: 1.26 / 1.73. Decided rules that arise: Q88 (day, coarse, label and nav rings), Q99a (the range band on light; the selected day and the range edges are mint fills, so they get a 1px inset ink edge; the today ring is already ink). Q101 does not arise: the header buttons are transparent icon buttons. An ink edge arises, so Q102 arises: b draws the edge in dark too, c keeps dark as today; under the brand theme the dark ink is the mint, so b and c render the same in dark. Findings for later, not render refusals: a selected today and a selected day in b look the same (the today ring is the same 1px inset ink as the new edge); the nav button ring resolves ink on the interactive button, a darker green (7.68 on light) than the cell rings (5.48). Later rounds, left out here: the picker overlay and bottom sheet, monthsShown 2 and 3 with their month labels and range header, the range hover preview, multiple selection, custom cell classes, a custom header template, the navigation animations, locales with other week starts.',
  madeBy: ['claude-opus-5-5'],
  states: {
    rest: {},
    selected: { selected: true },
    'selected-hover': { selected: true, selectedDay: 'hover' },
    'selected-focus-visible': { selected: true, selectedDay: 'focus-visible' },
    range: { range: true },
    'range-focus-visible': { range: true, rangeDay: 'focus-visible' },
    'day-hover': { day: 'hover' },
    'day-focus-visible': { day: 'focus-visible' },
    disabled: { disabled: true },
    limits: { limits: true, selected: true },
    'week-numbers': { weekNumbers: true, selected: true },
    comparison: { comparison: true },
    'year-view': { view: 'year', selected: true },
    'year-view-hover': { view: 'year', selected: true, day: 'hover' },
    'year-view-focus-visible': { view: 'year', selected: true, day: 'focus-visible' },
    'multi-year-view': { view: 'multiYear', selected: true },
    'nav-hover': { nav: 'hover' },
    'nav-focus-visible': { nav: 'focus-visible' },
    'label-hover': { label: 'hover' },
    'label-focus-visible': { label: 'focus-visible' },
    'long-label': { compact: true, selected: true },
  },
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="t-frame">${render(props)}</div>`,
      styles: [calendarStyles, frame].join('\n'),
    }),
});
