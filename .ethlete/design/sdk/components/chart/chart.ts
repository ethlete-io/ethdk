import { barChart, chartStyles, ChartMockMark, lineChart, pieChart } from '@ethlete/components/design/chart';
import { definePart, drawing } from '@design-system';
import frame from './chart.css?inline';

type Kind = 'bar' | 'line' | 'pie';

type Props = {
  kind: Kind;
  series?: boolean;
  mark?: ChartMockMark;
  empty?: boolean;
  longLabel?: boolean;
  points?: boolean;
  donut?: boolean;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BAR_2026 = { label: '2026', values: [32, 48, 41, 67, 54, 72] };
const BAR_2025 = { label: '2025', values: [28, 35, 44, 51, 47, 58] };
const VISITS = { label: 'Visits', values: [42, 55, 49, 63, 71, 38, 30] };
const SIGNUPS = { label: 'Sign-ups', values: [18, 24, 21, 30, 34, 15, 12] };
const SOURCES = [
  { label: 'Direct', value: 420 },
  { label: 'Search', value: 280 },
  { label: 'Social', value: 180 },
  { label: 'Referral', value: 120 },
];
const LONG_SOURCES = [
  { label: 'Direct', value: 420 },
  { label: 'Search engines and paid search campaigns', value: 280 },
  { label: 'Social', value: 180 },
  { label: 'Referral', value: 120 },
];

const PLOT_WIDTH = 410;

const render = (props: Props) => {
  if (props.kind === 'bar') {
    return barChart({
      plotWidth: PLOT_WIDTH,
      categories: props.longLabel ? LONG_MONTHS.map((month) => `${month} 2026`) : MONTHS,
      series: props.empty ? [{ label: '2026', values: [] }] : props.series ? [BAR_2025, BAR_2026] : [BAR_2026],
      empty: 'No sales in this period',
      mark: props.mark,
    });
  }

  if (props.kind === 'line') {
    return lineChart({
      plotWidth: PLOT_WIDTH,
      categories: DAYS,
      series: props.series ? [VISITS, SIGNUPS] : [VISITS],
      points: props.points,
      mark: props.mark,
    });
  }

  return pieChart({
    data: props.empty ? SOURCES.map((source) => ({ ...source, value: 0 })) : props.longLabel ? LONG_SOURCES : SOURCES,
    innerRadius: props.donut ? 0.6 : 0,
    mark: props.mark,
  });
};

export default definePart({
  note: "The SDK charts (et-bar-chart, et-line-chart, et-pie-chart), first drawing, drawn by their mocks from @ethlete/components/design/chart with the real markup and CSS: bar, line and pie chart sheets plus the axis, grid, legend, chart tooltip and line chart tooltip sheets, and the et-tooltip pane for the open tooltip. Framed as a 480px page with 16px padding; bar and line plots 410px wide, 240px high (the default); pie 200px (the default), donut innerRadius 0.6 with its total. Single series draw in the accent; two or more in accent mix steps (100 / 40 %, pie 100 / 80 / 60 / 40 %). States: bar (Jan to Jun), bar-series (2025 and 2026, legend), bar-hover and bar-focus-visible (Apr), bar-tooltip (Mar 2025, hover with its tooltip), bar-empty (projected etBarChartEmpty text), bar-long-label (January 2026 ... June 2026: the auto label spacing thins to every second label); line, line-series (Visits and Sign-ups, legend), line-points, line-hover and line-focus-visible (Thu: crosshair, slice dots, focus box), line-tooltip (Wed, active slice with the multi-series tooltip); pie, donut, pie-hover and pie-focus-visible (Search), pie-tooltip (Direct), pie-empty (all zero: the empty ring), pie-long-label (a long legend label, ellipsed). Static snapshot: the bar grow, line reveal and slice fade are drawn at rest. The lib has no loading state. Numbers (light / dark), from shot pixels at scale 2, brand mint, a: mint marks (bars, line 1, dots, legend and tooltip keys) 1.33 / 13.50; 40 % series (bar 2026, line 2) 1.13 / 2.79; axis and legend text (muted) 7.81 / 6.94; crosshair (subtle) 4.95 / 4.99; hover and focus tint 1.07 / 1.08; focus rings: bar and line (2px, series colour / primary) 1.33 / 13.50, pie (2px, text colour) 17.93 / 17.18. Q98 numbers only: grid lines vs page 1.26 / 1.73 (as the table's edges). Decided rules that arise: Q88 (bar, line and pie focus rings), Q99a (on light the line strokes, slice dots, line legend swatches and tooltip keys take ink in their mix steps; bars, pie slices and the square legend swatches are mint fills and get a 1px ink edge). Series colours otherwise stay data colours: the mix steps are kept. Q101 does not arise: no filled button. An ink edge arises, so Q102 arises: under the brand theme the dark ink is the mint, so the edge is invisible on the full mint fill but shows as a bright outline around the 40 % series in dark (b), while c drops it there. The thinned first and last category labels sit inside the plot (lib fix 3c26c2204). Findings for later, not render refusals: the pie focus ring in b is the same ink as its new 1px edge, only 1px wider, so a focused slice reads close to rest (a used the text colour); d draws it as an outer ring instead. The pie tooltip opens over the legend. Later rounds, left out here: horizontal and stacked bars, negative values, area and stacked area, the time scale, sankey, per-series colour themes, the title and note slots, touch tap.",
  madeBy: ['claude-opus-5-5'],
  states: {
    bar: { kind: 'bar' },
    'bar-series': { kind: 'bar', series: true },
    'bar-hover': { kind: 'bar', mark: { index: 3, force: 'hover' } },
    'bar-focus-visible': { kind: 'bar', mark: { index: 3, force: 'focus-visible' } },
    'bar-tooltip': { kind: 'bar', series: true, mark: { index: 4, force: 'hover', tooltip: true } },
    'bar-empty': { kind: 'bar', empty: true },
    'bar-long-label': { kind: 'bar', longLabel: true },
    line: { kind: 'line' },
    'line-series': { kind: 'line', series: true },
    'line-points': { kind: 'line', points: true },
    'line-hover': { kind: 'line', series: true, mark: { index: 3, force: 'hover' } },
    'line-focus-visible': { kind: 'line', series: true, mark: { index: 3, force: 'focus-visible' } },
    'line-tooltip': { kind: 'line', series: true, mark: { index: 2, force: 'hover', tooltip: true } },
    pie: { kind: 'pie' },
    donut: { kind: 'pie', donut: true },
    'pie-hover': { kind: 'pie', mark: { index: 1, force: 'hover' } },
    'pie-focus-visible': { kind: 'pie', mark: { index: 1, force: 'focus-visible' } },
    'pie-tooltip': { kind: 'pie', mark: { index: 0, force: 'hover', tooltip: true } },
    'pie-empty': { kind: 'pie', empty: true },
    'pie-long-label': { kind: 'pie', longLabel: true },
  },
  widths: [480],
  frame: (body) => `<div class="t-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: render(props),
      styles: [chartStyles, frame].join('\n'),
    }),
});
