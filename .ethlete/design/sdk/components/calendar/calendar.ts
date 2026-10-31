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
  widths: [480],
  frame: (body) => `<div class="t-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: render(props),
      styles: [calendarStyles, frame].join('\n'),
    }),
});
