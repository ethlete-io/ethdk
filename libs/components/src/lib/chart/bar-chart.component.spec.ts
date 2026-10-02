import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  ColorTheme,
  provideColorPalette,
  provideColorThemesWithTailwind4,
  provideSurfaceThemesWithTailwind4,
  SurfaceTheme,
} from '@ethlete/core';
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

@Component({
  selector: 'et-test-dense-bar-chart-host',
  template: `
    <et-bar-chart
      [data]="data()"
      [categoryLabelSpacing]="spacing()"
      [orientation]="orientation()"
      [height]="200"
      label="Daily sign-ups"
    >
      <h3 etBarChartTitle>Daily sign-ups</h3>
      <p class="custom-empty" etBarChartEmpty>No sign-ups yet</p>
      <p etBarChartNote>Source: CRM export</p>
    </et-bar-chart>
  `,
  imports: [BarChartComponent],
})
class DenseBarChartHostComponent {
  data = signal<BarChartDatum[]>(Array.from({ length: 30 }, (_, index) => ({ label: `${index + 1}`, value: index })));
  spacing = signal<number | 'auto'>('auto');
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

const PALETTE_THEMES: ColorTheme[] = ['ocean', 'sunset', 'forest'].map((name) => ({
  name,
  primary: {
    color: { default: '0 0 0', hover: '0 0 0', active: '0 0 0', disabled: '0 0 0' },
    onColor: { default: '255 255 255' },
  },
}));

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
    expect(chart.baseline()).toBeCloseTo(200 * (100 / 120));

    const [jan, feb, mar] = chart.bars();

    expect(feb?.y).toBe(0);
    expect(jan?.height).toBeCloseTo((feb?.height ?? 0) * 0.4);
    expect(mar?.isNegative).toBe(true);
    expect(mar?.y).toBeCloseTo(chart.baseline());
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
    expect(anchorYs[3]).toBeCloseTo(chart.baseline());
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

  it('shows a NaN value as the 0 bar it draws', () => {
    const { fixture, chart } = setup();

    fixture.componentInstance.data.set([{ label: 'Jan', value: NaN }]);
    fixture.detectChanges();

    expect(chart.bars()[0]?.valueText).toBe('0');
    expect(chart.table().rows).toEqual([{ header: 'Jan', cells: ['0'] }]);
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

describe('BarChartComponent category labels', () => {
  const setupDense = () => measure(DenseBarChartHostComponent);
  const axisTexts = (element: HTMLElement) =>
    [...element.querySelectorAll('.et-bar-chart-category-axis .et-chart-axis-label')].map((label) =>
      label.textContent?.trim(),
    );

  it('shows every label while each has the room', () => {
    const { chart } = setup();

    expect(chart.categoryLabelStride()).toBe(1);
    expect(chart.categoryLabels().map((label) => label.text)).toEqual(['Jan', 'Feb', 'Mar']);
  });

  it('thins dense labels to every nth, each spanning the bands up to the next shown label', () => {
    const { chart, element } = setupDense();

    expect(chart.categoryLabelStride()).toBe(3);
    expect(axisTexts(element)).toEqual(['1', '4', '7', '10', '13', '16', '19', '22', '25', '28']);
    expect(chart.categoryLabels()[1]).toEqual({ key: 3, text: '4', position: 35, extent: 30 });
  });

  it('takes an explicit spacing, and shows every label for 0', () => {
    const { fixture, chart } = setupDense();

    fixture.componentInstance.spacing.set(50);
    fixture.detectChanges();

    expect(chart.categoryLabelStride()).toBe(5);

    fixture.componentInstance.spacing.set(0);
    fixture.detectChanges();

    expect(chart.categoryLabels().length).toBe(30);
  });

  it('thins a horizontal chart by line height along its plot height', () => {
    const { fixture, chart } = setupDense();

    fixture.componentInstance.orientation.set('horizontal');
    fixture.detectChanges();

    expect(chart.categoryLabelStride()).toBe(3);
  });
});

describe('BarChartComponent slots', () => {
  const setupDense = () => measure(DenseBarChartHostComponent);

  it('projects the title before the figure and the note after it', () => {
    const { element } = setupDense();
    const chart = element.querySelector('et-bar-chart');
    const children = [...(chart?.children ?? [])];
    const indexOf = (selector: string) => children.findIndex((child) => child.matches(selector));

    expect(indexOf('[etBarChartTitle]')).toBeLessThan(indexOf('.et-bar-chart-figure'));
    expect(indexOf('[etBarChartNote]')).toBeGreaterThan(indexOf('.et-bar-chart-figure'));
  });

  it('shows the empty slot and no value labels only while there is no data', () => {
    const { fixture, chart, element } = setupDense();

    expect(chart.isEmpty()).toBe(false);
    expect(element.querySelector('.custom-empty')).toBeNull();

    fixture.componentInstance.data.set([]);
    fixture.detectChanges();

    expect(chart.isEmpty()).toBe(true);
    expect(element.querySelector('.et-bar-chart-empty .custom-empty')?.textContent?.trim()).toBe('No sign-ups yet');
    expect(element.querySelectorAll('.et-bar-chart-value-axis .et-chart-axis-label').length).toBe(0);
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

  it('draws with the palette list of the surface it sits on', () => {
    const page: SurfaceTheme = {
      name: 'page',
      type: 'dark',
      elevation: 0,
      isDefault: true,
      background: '0 0 0',
      color: '255 255 255',
      colorMuted: '180 180 180',
      colorSubtle: '80 80 80',
      border: '40 40 40',
    };
    const { chart } = setupSeries({
      providers: [
        provideSurfaceThemesWithTailwind4([page]),
        provideColorPalette({
          default: [
            { token: 'ocean', label: 'Home' },
            { token: 'sunset', label: 'Away' },
          ],
          page: [
            { token: 'ocean-bright', label: 'Home' },
            { token: 'sunset-bright', label: 'Away' },
          ],
        }),
      ],
    });

    expect(chart.seriesColors()).toEqual(['ocean-bright', 'sunset-bright', null]);
  });

  it('keeps a single-series chart on the accent even with a palette', () => {
    const { chart } = measure(BarChartHostComponent, [PALETTE]);

    expect(chart.bars().every((bar) => bar.colorToken === null)).toBe(true);
  });

  it('steps the accent from 100% down to a 40% mix for series without a color', () => {
    const { chart, element } = setupSeries({ providers: [] });

    expect(chart.bars().map((bar) => bar.accentMix)).toEqual([100, 70, 40, 100, 40, 100, 70, 40]);
    expect(chart.legendItems().map((item) => item.accentMix)).toEqual([100, 70, 40]);
    expect(
      [...element.querySelectorAll<SVGGElement>('.et-bar-chart-bar')]
        .slice(0, 3)
        .map((bar) => bar.style.getPropertyValue('--_et-chart-accent-mix')),
    ).toEqual(['100%', '70%', '40%']);
    expect(
      [...element.querySelectorAll<HTMLElement>('.et-chart-legend-swatch')].map((swatch) =>
        swatch.style.getPropertyValue('--_et-chart-accent-mix'),
      ),
    ).toEqual(['100%', '70%', '40%']);
  });

  it('keeps a series with a color at full strength and steps only the rest', () => {
    const { fixture, chart } = setupSeries({ providers: [] });

    fixture.componentInstance.series.update(([home, away, cup]) => [
      home as BarChartSeries,
      { ...(away as BarChartSeries), colorToken: 'lava' },
      cup as BarChartSeries,
    ]);
    fixture.detectChanges();

    expect(chart.legendItems().map((item) => item.accentMix)).toEqual([100, null, 40]);
    expect(
      chart
        .bars()
        .slice(0, 3)
        .map((bar) => bar.accentMix),
    ).toEqual([100, null, 40]);
  });

  it('draws a single series at full strength', () => {
    const { chart, element } = measure(BarChartHostComponent, []);

    expect(chart.bars().every((bar) => bar.accentMix === null)).toBe(true);
    expect(
      element.querySelector<SVGGElement>('.et-bar-chart-bar')?.style.getPropertyValue('--_et-chart-accent-mix'),
    ).toBe('');
  });

  it('does not warn when series without a color take steps of the accent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    setupSeries({ providers: [] });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns in dev mode when two series share a colorToken', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fixture } = setupSeries({ providers: [] });

    fixture.componentInstance.series.update(([home, away, cup]) => [
      { ...(home as BarChartSeries), colorToken: 'lava' },
      { ...(away as BarChartSeries), colorToken: 'lava' },
      cup as BarChartSeries,
    ]);
    fixture.detectChanges();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('share the colorToken "lava"'));
    warn.mockRestore();
  });

  it('warns in dev mode when a series key matches no datum', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fixture } = setupSeries();

    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('[BarChartDirective]'));

    fixture.componentInstance.series.update((series) => [...series, { key: 'boxoffice', label: 'Box office' }]);
    fixture.detectChanges();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"boxoffice"'));
    warn.mockRestore();
  });

  it('does not warn when the palette covers every series', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    setupSeries({ providers: [PALETTE, provideColorThemesWithTailwind4(PALETTE_THEMES)] });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
