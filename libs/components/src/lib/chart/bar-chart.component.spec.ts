import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideColorPalette } from '@ethlete/core';
import '../../test-helpers';
import { BarChartComponent } from './bar-chart.component';
import {
  BarChartDatum,
  BarChartDirective,
  BarChartLayout,
  BarChartOrientation,
  BarChartSeries,
  BarChartSeriesDatum,
} from './headless/bar-chart.directive';
import { ChartPlotDirective } from './headless/chart-plot.directive';

@Component({
  selector: 'et-test-bar-chart-host',
  template: `<et-bar-chart [data]="data()" [height]="200" [orientation]="orientation()" label="Sign-ups" />`,
  imports: [BarChartComponent],
})
class BarChartHostComponent {
  data = signal<BarChartDatum[]>([
    { label: 'Jan', value: 40 },
    { label: 'Feb', value: 100 },
    { label: 'Mar', value: -20 },
  ]);
  orientation = signal<BarChartOrientation>('vertical');
}

@Component({
  selector: 'et-test-series-bar-chart-host',
  template: `
    <et-bar-chart
      [data]="data()"
      [series]="series()"
      [layout]="layout()"
      [orientation]="orientation()"
      [height]="200"
      label="Goals"
      categoryHeader="Month"
    />
  `,
  imports: [BarChartComponent],
})
class SeriesBarChartHostComponent {
  data = signal<BarChartSeriesDatum[]>([
    { label: 'Jan', values: { home: 30, away: 20, cup: -10 } },
    { label: 'Feb', values: { home: 60, away: null, cup: 0 } },
    { label: 'Mar', values: { home: 10, away: 40, cup: 10 } },
  ]);
  series = signal<BarChartSeries[]>([
    { key: 'home', label: 'Home' },
    { key: 'away', label: 'Away' },
    { key: 'cup', label: 'Cup' },
  ]);
  layout = signal<BarChartLayout>('grouped');
  orientation = signal<BarChartOrientation>('vertical');
}

const PLOT_WIDTH = 300;

const measure = <T>(component: new () => T, providers: unknown[] = []) => {
  TestBed.configureTestingModule({ providers: providers as never[] });

  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();

  const chart = fixture.debugElement.query(By.directive(BarChartDirective)).injector.get(BarChartDirective);
  chart.plot.set({ width: signal(PLOT_WIDTH) } as unknown as ChartPlotDirective);
  fixture.detectChanges();

  return { fixture, chart, element: fixture.nativeElement as HTMLElement };
};

const setup = () => measure(BarChartHostComponent);

const PALETTE = provideColorPalette([
  { token: 'ocean', label: 'Ocean' },
  { token: 'sunset', label: 'Sunset' },
  { token: 'forest', label: 'Forest' },
]);

const setupSeries = (
  options: { layout?: BarChartLayout; orientation?: BarChartOrientation; providers?: unknown[] } = {},
) => {
  const result = measure(SeriesBarChartHostComponent, options.providers ?? [PALETTE]);

  result.fixture.componentInstance.layout.set(options.layout ?? 'grouped');
  result.fixture.componentInstance.orientation.set(options.orientation ?? 'vertical');
  result.fixture.detectChanges();

  return result;
};

const barsOf = (chart: BarChartDirective) =>
  Object.fromEntries(chart.bars().map((bar) => [`${bar.datum.label}:${bar.series?.key ?? ''}`, bar]));

describe('BarChartComponent', () => {
  it('scales each bar to its value from a shared baseline', () => {
    const { chart } = setup();

    expect(chart.valueTicks().domain).toEqual([-20, 100]);
    expect(chart.baselineY()).toBeCloseTo(200 * (100 / 120));

    const [jan, feb, mar] = chart.bars();

    expect(feb?.y).toBe(0);
    expect(jan?.height).toBeCloseTo((feb?.height ?? 0) * 0.4);
    expect(mar?.isNegative).toBe(true);
    expect(mar?.y).toBeCloseTo(chart.baselineY());
    expect(mar?.height).toBeCloseTo((feb?.height ?? 0) * 0.2);
  });

  it('renders one focusable mark per datum, named by its category and described by its value', () => {
    const { element } = setup();

    const bars = [...element.querySelectorAll('.et-bar-chart-bar')];
    const descriptions = bars.map((bar) =>
      (bar.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim())
        .join(' '),
    );

    expect(bars.map((bar) => bar.getAttribute('aria-label'))).toEqual(['Jan', 'Feb', 'Mar']);
    expect(descriptions).toEqual(['40', '100', '-20']);
    expect(bars.every((bar) => bar.getAttribute('tabindex') === '0')).toBe(true);
    expect(bars.every((bar) => bar.getAttribute('role') === 'img')).toBe(true);
    expect(element.querySelectorAll('.et-bar-chart-bar-mark').length).toBe(3);
  });

  it('anchors each tooltip at the data end of its bar, and a zero bar at the baseline', () => {
    const { fixture, chart, element } = setup();

    fixture.componentInstance.data.update((data) => [...data, { label: 'Apr', value: 0 }]);
    fixture.detectChanges();

    const anchorYs = [...element.querySelectorAll('.et-bar-chart-bar-anchor')].map((anchor) =>
      Number(anchor.getAttribute('y')),
    );
    const [jan, , mar] = chart.bars();

    expect(anchorYs[0]).toBeCloseTo(jan?.y ?? NaN);
    expect(anchorYs[1]).toBe(0);
    expect(anchorYs[2]).toBeCloseTo((mar?.y ?? NaN) + (mar?.height ?? NaN));
    expect(anchorYs[3]).toBeCloseTo(chart.baselineY());
  });

  it('mirrors the data in a table view', () => {
    const { element } = setup();

    const rows = [...element.querySelectorAll('.et-chart-table tbody tr')].map((row) =>
      [...row.children].map((cell) => cell.textContent?.trim()),
    );

    expect(element.querySelector('.et-chart-table caption')?.textContent?.trim()).toBe('Sign-ups');
    expect(rows).toEqual([
      ['Jan', '40'],
      ['Feb', '100'],
      ['Mar', '-20'],
    ]);
  });

  it('shows no legend for a single series', () => {
    const { element } = setup();

    expect(element.querySelector('.et-chart-legend')).toBeNull();
  });

  it('draws no marks until the plot has a width', () => {
    const fixture = TestBed.createComponent(BarChartHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.et-bar-chart-bar')).toBeNull();
  });
});

describe('BarChartComponent horizontal', () => {
  it('grows bars to the right of a vertical baseline, each category in its own row', () => {
    const { fixture, chart } = setup();

    fixture.componentInstance.orientation.set('horizontal');
    fixture.detectChanges();

    const baseline = PLOT_WIDTH * (20 / 120);
    const [jan, feb] = chart.bars();

    expect(chart.baseline()).toBeCloseTo(baseline);
    expect(feb?.x).toBeCloseTo(baseline);
    expect(feb?.width).toBeCloseTo(PLOT_WIDTH - baseline);
    expect(jan?.width).toBeCloseTo((feb?.width ?? 0) * 0.4);
    expect(jan?.height).toBe(24);
    expect(jan?.y).toBeCloseTo(200 / 3 / 2 - 12);
    expect(feb?.y).toBeCloseTo(200 / 3 + 200 / 3 / 2 - 12);
    expect(feb?.target).toEqual({ x: 0, y: 200 / 3, width: PLOT_WIDTH, height: 200 / 3 });
  });

  it('rounds the data end, and points the tooltip away from the baseline', () => {
    const { fixture, chart } = setup();

    fixture.componentInstance.orientation.set('horizontal');
    fixture.detectChanges();

    const [jan, , mar] = chart.bars();

    expect(jan?.placement).toBe('right');
    expect(jan?.anchor).toEqual({ x: (jan?.x ?? 0) + (jan?.width ?? 0), y: jan?.y, width: 0, height: 24 });
    expect(jan?.path).toContain('A4,4');
    expect(mar?.isNegative).toBe(true);
    expect(mar?.x).toBeCloseTo(0);
    expect((mar?.x ?? 0) + (mar?.width ?? 0)).toBeCloseTo(chart.baseline());
    expect(mar?.placement).toBe('left');
    expect(mar?.anchor.x).toBeCloseTo(0);
  });

  it('puts the value ticks along the bottom', () => {
    const { fixture, chart } = setup();

    fixture.componentInstance.orientation.set('horizontal');
    fixture.detectChanges();

    const ticks = chart.ticks();

    expect(ticks.map((tick) => tick.value)).toEqual([-20, 0, 20, 40, 60, 80, 100]);
    expect(ticks.at(-1)).toEqual({ value: 100, text: '100', position: PLOT_WIDTH, x: PLOT_WIDTH, y: 200 });
  });
});

describe('BarChartComponent grouped', () => {
  it('lays the series side by side within each category, with a 2px gap between them', () => {
    const { chart } = setupSeries();

    const bars = barsOf(chart);
    const home = bars['Jan:home'];
    const away = bars['Jan:away'];
    const cup = bars['Jan:cup'];

    expect(home?.width).toBe(24);
    expect((away?.x ?? 0) - ((home?.x ?? 0) + (home?.width ?? 0))).toBeCloseTo(2);
    expect((cup?.x ?? 0) - ((away?.x ?? 0) + (away?.width ?? 0))).toBeCloseTo(2);
    expect((home?.x ?? 0) + ((cup?.x ?? 0) + (cup?.width ?? 0) - (home?.x ?? 0)) / 2).toBeCloseTo(50);
    expect(cup?.isNegative).toBe(true);
  });

  it('draws no bar for a missing value, and a zero bar for zero', () => {
    const { chart } = setupSeries();

    const bars = barsOf(chart);

    expect(bars['Feb:away']).toBeUndefined();
    expect(bars['Feb:cup']?.height).toBe(0);
  });

  it('tiles each category band with the hit targets of its bars', () => {
    const { chart } = setupSeries();

    const bars = barsOf(chart);
    const targets = ['home', 'away', 'cup'].map((key) => bars[`Mar:${key}`]?.target);

    expect(targets[0]?.x).toBeCloseTo(200);
    expect((targets[0]?.x ?? 0) + (targets[0]?.width ?? 0)).toBeCloseTo(targets[1]?.x ?? NaN);
    expect((targets[1]?.x ?? 0) + (targets[1]?.width ?? 0)).toBeCloseTo(targets[2]?.x ?? NaN);
    expect((targets[2]?.x ?? 0) + (targets[2]?.width ?? 0)).toBeCloseTo(300);
    expect(targets.every((target) => target?.y === 0 && target.height === 200)).toBe(true);
  });

  it('orders the marks category by category, naming each by category and series', () => {
    const { element } = setupSeries();

    const names = [...element.querySelectorAll('.et-bar-chart-bar')].map((bar) => bar.getAttribute('aria-label'));

    expect(names).toEqual([
      'Jan, Home',
      'Jan, Away',
      'Jan, Cup',
      'Feb, Home',
      'Feb, Cup',
      'Mar, Home',
      'Mar, Away',
      'Mar, Cup',
    ]);
  });

  it('shows a legend with every series, and a table with a column per series', () => {
    const { element } = setupSeries();

    const legend = [...element.querySelectorAll('.et-chart-legend-label')].map((label) => label.textContent?.trim());
    const header = [...element.querySelectorAll('.et-chart-table thead th')].map((cell) => cell.textContent?.trim());
    const rows = [...element.querySelectorAll('.et-chart-table tbody tr')].map((row) =>
      [...row.children].map((cell) => cell.textContent?.trim()),
    );

    expect(legend).toEqual(['Home', 'Away', 'Cup']);
    expect(header).toEqual(['Month', 'Home', 'Away', 'Cup']);
    expect(rows).toEqual([
      ['Jan', '30', '20', '-10'],
      ['Feb', '60', '', '0'],
      ['Mar', '10', '40', '10'],
    ]);
  });
});

describe('BarChartComponent stacked', () => {
  it('spans the value axis over the stack totals on either side of zero', () => {
    const { chart } = setupSeries({ layout: 'stacked' });

    expect(chart.valueTicks().domain).toEqual([-10, 60]);
  });

  it('stacks the segments on one bar, with a 2px gap between them and a square inner end', () => {
    const { chart } = setupSeries({ layout: 'stacked' });

    const bars = barsOf(chart);
    const home = bars['Mar:home'];
    const away = bars['Mar:away'];
    const cup = bars['Mar:cup'];
    const unit = 200 / 70;

    expect(home?.x).toBe(away?.x);
    expect(home?.width).toBe(24);
    expect(home?.y).toBeCloseTo(chart.baseline() - 10 * unit + 1);
    expect(home?.height).toBeCloseTo(10 * unit - 1);
    expect(home?.y ?? 0).toBeCloseTo((away?.y ?? 0) + (away?.height ?? 0) + 2);
    expect(cup?.y).toBeCloseTo(chart.baseline() - 60 * unit);
    expect(home?.path).not.toContain('A');
    expect(cup?.path).toContain('A');
    expect(cup?.placement).toBe('top');
  });

  it('stacks negative values down from the baseline, rounded at their lower end', () => {
    const { chart } = setupSeries({ layout: 'stacked' });

    const bars = barsOf(chart);
    const cup = bars['Jan:cup'];
    const away = bars['Jan:away'];

    expect(cup?.isNegative).toBe(true);
    expect(cup?.y).toBeCloseTo(chart.baseline());
    expect(cup?.placement).toBe('bottom');
    expect(cup?.anchor.y).toBeCloseTo((cup?.y ?? 0) + (cup?.height ?? 0));
    expect(cup?.path).toContain('A');
    expect(away?.path).toContain('A');
    expect(bars['Jan:home']?.path).not.toContain('A');
  });

  it('skips zero and missing segments', () => {
    const { chart } = setupSeries({ layout: 'stacked' });

    const bars = barsOf(chart);

    expect(bars['Feb:away']).toBeUndefined();
    expect(bars['Feb:cup']).toBeUndefined();
    expect(bars['Feb:home']?.path).toContain('A');
  });

  it('splits the column between the segments as hit targets, the outer ones reaching the plot edge', () => {
    const { chart } = setupSeries({ layout: 'stacked' });

    const bars = barsOf(chart);
    const home = bars['Jan:home'];
    const away = bars['Jan:away'];
    const cup = bars['Jan:cup'];

    expect(home?.target.x).toBe(0);
    expect(home?.target.width).toBe(100);
    expect((home?.target.y ?? 0) + (home?.target.height ?? 0)).toBeCloseTo(chart.baseline());
    expect((away?.target.y ?? 0) + (away?.target.height ?? 0)).toBeCloseTo(home?.target.y ?? NaN);
    expect(away?.target.y).toBe(0);
    expect(cup?.target.y).toBeCloseTo(chart.baseline());
    expect((cup?.target.y ?? 0) + (cup?.target.height ?? 0)).toBeCloseTo(200);
  });

  it('stacks to the right when horizontal', () => {
    const { chart } = setupSeries({ layout: 'stacked', orientation: 'horizontal' });

    const bars = barsOf(chart);
    const home = bars['Mar:home'];
    const cup = bars['Mar:cup'];
    const unit = PLOT_WIDTH / 70;

    expect(home?.x).toBeCloseTo(chart.baseline());
    expect(home?.width).toBeCloseTo(10 * unit - 1);
    expect((cup?.x ?? 0) + (cup?.width ?? 0)).toBeCloseTo(chart.baseline() + 60 * unit);
    expect(cup?.placement).toBe('right');
    expect(bars['Jan:cup']?.placement).toBe('left');
  });
});

describe('BarChartComponent series colors', () => {
  it('draws series i in palette entry i, unless the series names its own color', () => {
    const { fixture, chart } = setupSeries({ providers: [PALETTE] });

    fixture.componentInstance.series.update(([home, away, cup]) => [
      home as BarChartSeries,
      away as BarChartSeries,
      { ...(cup as BarChartSeries), colorToken: 'lava' },
    ]);
    fixture.detectChanges();

    expect(chart.seriesColors()).toEqual(['ocean', 'sunset', 'lava']);
    expect(chart.bars().map((bar) => bar.colorToken)).toEqual([
      'ocean',
      'sunset',
      'lava',
      'ocean',
      'lava',
      'ocean',
      'sunset',
      'lava',
    ]);
    expect(chart.legendItems().map((item) => item.colorToken)).toEqual(['ocean', 'sunset', 'lava']);
  });

  it('keeps a single-series chart on the accent even with a palette', () => {
    const { chart } = measure(BarChartHostComponent, [PALETTE]);

    expect(chart.bars().every((bar) => bar.colorToken === null)).toBe(true);
  });

  it('warns in dev mode when two series would share the accent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    setupSeries({ providers: [] });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('share one color'));
    warn.mockRestore();
  });

  it('does not warn when the palette covers every series', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    setupSeries({ providers: [PALETTE] });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
