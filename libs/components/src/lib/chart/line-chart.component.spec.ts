import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideColorPalette } from '@ethlete/core';
import '../../test-helpers';
import { ChartPlotDirective } from './headless/chart-plot.directive';
import {
  LineChartDatum,
  LineChartDirective,
  LineChartSeries,
  LineChartSeriesDatum,
} from './headless/line-chart.directive';
import { LineChartComponent } from './line-chart.component';

@Component({
  selector: 'et-test-line-chart-host',
  template: `
    <et-line-chart
      [data]="data()"
      [series]="series()"
      [area]="area()"
      [stacked]="stacked()"
      [height]="200"
      [timeZone]="timeZone()"
      label="Visitors"
    />
  `,
  imports: [LineChartComponent],
})
class LineChartHostComponent {
  data = signal<LineChartDatum[] | LineChartSeriesDatum[]>([
    { x: 'Jan', value: 40 },
    { x: 'Feb', value: 100 },
    { x: 'Mar', value: null },
    { x: 'Apr', value: 60 },
    { x: 'May', value: 80 },
  ]);
  series = signal<LineChartSeries[]>([]);
  area = signal(false);
  stacked = signal(false);
  timeZone = signal<string | null>('Europe/Berlin');
}

const PLOT_WIDTH = 500;

const PALETTE = provideColorPalette([
  { token: 'ocean', label: 'Ocean' },
  { token: 'sunset', label: 'Sunset' },
]);

const setup = () => {
  TestBed.configureTestingModule({ providers: [PALETTE] });

  const fixture = TestBed.createComponent(LineChartHostComponent);
  fixture.detectChanges();

  const chart = fixture.debugElement.query(By.directive(LineChartDirective)).injector.get(LineChartDirective);
  chart.plot.set({ width: signal(PLOT_WIDTH) } as unknown as ChartPlotDirective);
  fixture.detectChanges();

  return { fixture, host: fixture.componentInstance, chart, element: fixture.nativeElement as HTMLElement };
};

const SERIES: LineChartSeries[] = [
  { key: 'home', label: 'Home' },
  { key: 'away', label: 'Away' },
];

const SERIES_DATA: LineChartSeriesDatum[] = [
  { x: 'W1', values: { home: 10, away: 5 } },
  { x: 'W2', values: { home: 20, away: null } },
  { x: 'W3', values: { home: 30, away: 15 } },
];

describe('LineChartComponent', () => {
  it('spaces categories evenly, each centered in its share of the plot', () => {
    const { chart } = setup();

    expect(chart.positions()).toEqual([50, 150, 250, 350, 450]);
    expect(chart.slices().map((slice) => slice.target.x)).toEqual([0, 100, 200, 300, 400]);
    expect(chart.slices().map((slice) => slice.target.width)).toEqual([100, 100, 100, 100, 100]);
  });

  it('breaks the line at a missing value', () => {
    const { chart } = setup();
    const [line] = chart.lines();

    expect(chart.valueTicks().domain).toEqual([0, 100]);
    expect(line?.linePath).toBe('M50,120L150,0M350,80L450,40');
    expect(line?.points.map((point) => point.isIsolated)).toEqual([false, false, false, false]);
  });

  it('keeps a point with no defined neighbour as an isolated dot', () => {
    const { host, fixture, chart, element } = setup();

    host.data.set([
      { x: 'Jan', value: 40 },
      { x: 'Feb', value: null },
      { x: 'Mar', value: 60 },
      { x: 'Apr', value: null },
    ]);
    fixture.detectChanges();

    expect(chart.lines()[0]?.linePath).toBe('');
    expect(chart.lines()[0]?.points.every((point) => point.isIsolated)).toBe(true);
    expect(element.querySelectorAll('.et-line-chart-point')).toHaveLength(2);
  });

  it('fills an area down to the zero baseline', () => {
    const { host, fixture, chart, element } = setup();

    host.area.set(true);
    fixture.detectChanges();

    expect(chart.lines()[0]?.areaPath).toBe('M50,120L150,0L150,200L50,200ZM350,80L450,40L450,200L350,200Z');
    expect(element.querySelectorAll('.et-line-chart-area')).toHaveLength(1);
  });

  it('stacks each series on the one below and fills between them', () => {
    const { host, fixture, chart } = setup();

    host.data.set(SERIES_DATA);
    host.series.set(SERIES);
    host.area.set(true);
    host.stacked.set(true);
    fixture.detectChanges();

    expect(chart.valueTicks().domain).toEqual([0, 50]);

    const [home, away] = chart.lines();
    const y = (value: number) => 200 - (value / 50) * 200;

    expect(home?.points.map((point) => point.y)).toEqual([y(10), y(20), y(30)]);
    expect(away?.points.map((point) => point.y)).toEqual([y(15), y(45)]);
    expect(away?.linePath).toBe('');
    expect(away?.areaPath).toBe('');
    expect(chart.slices()[2]?.entries.map((entry) => entry.value)).toEqual([30, 15]);
  });

  it('reads out every series with a value at an x, and names it by the x', () => {
    const { host, fixture, chart, element } = setup();

    host.data.set(SERIES_DATA);
    host.series.set(SERIES);
    fixture.detectChanges();

    expect(chart.slices().map((slice) => slice.description)).toEqual([
      'Home 10, Away 5',
      'Home 20',
      'Home 30, Away 15',
    ]);

    const slices = [...element.querySelectorAll('.et-line-chart-slice')];

    expect(slices.map((slice) => slice.getAttribute('aria-label'))).toEqual(['W1', 'W2', 'W3']);
    expect(slices.map((slice) => slice.getAttribute('role'))).toEqual(['img', 'img', 'img']);
  });

  it('points the tooltip at the topmost point of an x', () => {
    const { host, fixture, chart } = setup();

    host.data.set(SERIES_DATA);
    host.series.set(SERIES);
    fixture.detectChanges();

    const [first] = chart.slices();

    expect(first?.anchor).toEqual({
      x: first?.position,
      y: Math.min(...(first?.entries ?? []).map((e) => e.y)),
      width: 0,
      height: 0,
    });
  });

  it('gives the plot one tab stop, and moves it with the focused x', () => {
    const { chart, fixture, element } = setup();
    const tabIndexes = () =>
      [...element.querySelectorAll('.et-line-chart-slice')].map((slice) => slice.getAttribute('tabindex'));

    expect(tabIndexes()).toEqual(['0', '-1', '-1', '-1', '-1']);

    chart.focusSlice(3);
    fixture.detectChanges();

    expect(tabIndexes()).toEqual(['-1', '-1', '-1', '0', '-1']);
    expect(document.activeElement).toBe(element.querySelectorAll('.et-line-chart-slice')[3]);

    chart.focusSlice(99);
    fixture.detectChanges();

    expect(tabIndexes()).toEqual(['-1', '-1', '-1', '-1', '0']);
  });

  it('lays instants out by time, sorted, and labels them in the chart time zone', () => {
    const { host, fixture, chart } = setup();

    host.data.set([
      { x: new Date('2025-03-31T22:00:00Z'), value: 3 },
      { x: new Date('2025-03-28T23:00:00Z'), value: 1 },
      { x: new Date('2025-03-29T23:00:00Z'), value: 2 },
    ]);
    fixture.detectChanges();

    expect(chart.isTime()).toBe(true);
    expect(chart.slices().map((slice) => slice.label)).toEqual(['Mar 29, 2025', 'Mar 30, 2025', 'Apr 1, 2025']);

    const [first, second, third] = chart.positions();

    expect(first).toBe(0);
    expect(third).toBe(PLOT_WIDTH);
    expect(second).toBeCloseTo(PLOT_WIDTH * (24 / (24 + 23 + 24)));
    expect(chart.xLabels().map((label) => label.text.replace(/\s/g, ' '))).toEqual([
      'Mar 29',
      '12:00 PM',
      'Mar 30',
      '12:00 PM',
      'Mar 31',
      '12:00 PM',
      'Apr 1',
    ]);
  });

  it('puts the time-axis labels on midnights of the chart time zone, not the viewer one', () => {
    const { host, fixture, chart } = setup();

    host.data.set([
      { x: new Date('2025-06-01T00:00:00Z'), value: 1 },
      { x: new Date('2025-06-03T00:00:00Z'), value: 2 },
    ]);
    host.timeZone.set('America/New_York');
    fixture.detectChanges();

    expect(chart.xLabels().map((label) => label.text.replace(/\s/g, ' '))).toEqual([
      'Jun 1',
      '12:00 PM',
      'Jun 2',
      '12:00 PM',
    ]);
    expect(chart.slices().map((slice) => slice.label.replace(/\s/g, ' '))).toEqual([
      'May 31, 2025, 8:00 PM',
      'Jun 2, 2025, 8:00 PM',
    ]);
  });

  it('builds a table with a row per x and a column per series', () => {
    const { host, fixture, chart } = setup();

    host.data.set(SERIES_DATA);
    host.series.set(SERIES);
    fixture.detectChanges();

    expect(chart.table()).toEqual({
      columns: ['Category', 'Home', 'Away'],
      rows: [
        { header: 'W1', cells: ['10', '5'] },
        { header: 'W2', cells: ['20', ''] },
        { header: 'W3', cells: ['30', '15'] },
      ],
    });
  });

  it('names each series in the legend with its palette color', () => {
    const { host, fixture, chart, element } = setup();

    host.data.set(SERIES_DATA);
    host.series.set(SERIES);
    fixture.detectChanges();

    expect(chart.legendItems().map((item) => item.colorToken)).toEqual(['ocean', 'sunset']);
    expect(element.querySelector('.et-chart-legend')?.getAttribute('data-mark')).toBe('line');
  });

  it('throws in dev mode when the data mixes dates and categories', () => {
    const { host, fixture } = setup();

    host.data.set([
      { x: new Date('2025-01-01T00:00:00Z'), value: 1 },
      { x: 'Feb', value: 2 },
    ]);

    expect(() => fixture.detectChanges()).toThrow(/ET5120/);
  });
});
