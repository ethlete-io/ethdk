import { calendar, calendarStyles, CalendarMockOptions } from '@ethlete/components/design/calendar';
import { definePart, drawing } from '@design-system';
import frame from './calendar.css?inline';

type Interaction = 'hover' | 'focus-visible';

type View = NonNullable<CalendarMockOptions['view']>;

type Props = {
  view?: View;
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

const ZOOM_OUT: Record<View, string> = { month: 'year-view', year: 'multi-year-view', multiYear: 'selected' };

const action = (key: string) => `data-et-action="${key}"`;

const cellAction = (view: View, range: boolean) =>
  view === 'year'
    ? 'emit:monthSelect'
    : view === 'multiYear'
      ? 'emit:yearSelect'
      : range
        ? 'emit:rangeValueChange'
        : 'emit:valueChange';

const declareCells = (html: string, key: string) =>
  html.replace(/<button [^>]*class="et-calendar-cell[^>]*>/g, (cell) =>
    cell.includes('aria-disabled') ? cell : cell.replace('<button ', `<button ${action(key)} `),
  );

const withAction = (key: string | undefined, extra?: string) =>
  [key && action(key), extra].filter(Boolean).join(' ') || undefined;

const render = (props: Props) => {
  const view = props.view ?? 'month';
  const coarseKey = view === 'year' ? '2026-03' : '2021';
  const navigate = props.limits ? undefined : 'emit:activeMonthChange';

  const html = calendar({
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
    previousAttributes: withAction(navigate),
    nextAttributes: withAction(navigate, props.nav ? `data-et-force="${props.nav}"` : undefined),
    labelAttributes: withAction(ZOOM_OUT[view], props.label ? `data-et-force="${props.label}"` : undefined),
    attributes: props.compact ? 'style="--et-calendar-cell-size: 32px"' : undefined,
  });

  return declareCells(html, cellAction(view, Boolean(props.range || props.comparison)));
};

export default definePart({
  note: 'Decided rules only',
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
  describe: {
    rest: 'September 2026 with today on the 14th; check the today mark, the weekday header and the month label.',
    selected: 'The 17th selected; check the filled day and that today keeps its own mark.',
    'selected-hover': 'The selected 17th hovered; check that the fill shows its hover step.',
    'selected-focus-visible': 'The selected 17th with keyboard focus; check that the ring shows around the filled day.',
    range: 'The range from the 9th to the 16th; check the filled ends and the band between them.',
    'range-focus-visible': 'The range start with keyboard focus; check that the ring shows over the range end.',
    'day-hover': 'The 22nd hovered; check its hover tint.',
    'day-focus-visible': 'The 22nd with keyboard focus; check the focus ring around the day.',
    disabled: 'Four weekend days disabled; check that they fade and the others stay normal.',
    limits: 'Days outside the 7th to the 24th out of range, the 17th selected; check that the out-of-range days fade.',
    'week-numbers':
      'The month with a week number column and the 17th selected; check that the numbers align with their rows.',
    comparison: 'A range of the 15th to the 18th beside a comparison week; check that the two ranges read apart.',
    'year-view': 'The months of 2026 with May selected; check the filled month and the grid of twelve.',
    'year-view-hover': 'The year view with March hovered; check its hover tint.',
    'year-view-focus-visible': 'The year view with March under keyboard focus; check the focus ring around it.',
    'multi-year-view': 'A span of years with 2024 selected; check the filled year and the grid.',
    'nav-hover': 'The next-month button hovered; check its hover tint.',
    'nav-focus-visible': 'The next-month button with keyboard focus; check the focus ring around it.',
    'label-hover': 'The month label button hovered; check its hover tint.',
    'label-focus-visible': 'The month label button with keyboard focus; check the focus ring around it.',
    'long-label':
      'The month at a 32 px cell size with the 17th selected; check that the header label fits and the grid stays square.',
  },
  widths: [480],
  frame: (body) => `<div class="t-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: render(props),
      styles: [calendarStyles, frame].join('\n'),
    }),
});
