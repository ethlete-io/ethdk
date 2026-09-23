import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideColorPalette } from '@ethlete/core';
import '../../test-helpers';
import { ChartPlotDirective } from './headless/chart-plot.directive';
import { PieChartDatum, PieChartDirective } from './headless/pie-chart.directive';
import { PieChartComponent } from './pie-chart.component';

@Component({
  selector: 'et-test-pie-chart-host',
  template: `
    <et-pie-chart [data]="data()" [innerRadius]="innerRadius()" [showTotal]="showTotal()" label="Visits">
      @if (center()) {
        <span class="custom-center" etPieChartCenter>Last 30 days</span>
      }
    </et-pie-chart>
  `,
  imports: [PieChartComponent],
})
class PieChartHostComponent {
  data = signal<PieChartDatum[]>([
    { label: 'Search', value: 50 },
    { label: 'Direct', value: 25 },
    { label: 'Social', value: 25 },
  ]);
  innerRadius = signal(0);
  showTotal = signal(false);
  center = signal(false);
}

const PALETTE = provideColorPalette([
  { token: 'ocean', label: 'Ocean' },
  { token: 'sunset', label: 'Sunset' },
]);

const setup = (options: { plotWidth?: number; providers?: unknown[] } = {}) => {
  TestBed.configureTestingModule({ providers: (options.providers ?? []) as never[] });

  const fixture = TestBed.createComponent(PieChartHostComponent);
  fixture.detectChanges();

  const chart = fixture.debugElement.query(By.directive(PieChartDirective)).injector.get(PieChartDirective);
  chart.plot.set({ width: signal(options.plotWidth ?? 300) } as unknown as ChartPlotDirective);
  fixture.detectChanges();

  return { fixture, chart, host: fixture.componentInstance, element: fixture.nativeElement as HTMLElement };
};

const TAU = Math.PI * 2;

describe('PieChartComponent', () => {
  it('fits the circle in `size`, or in a narrower plot', () => {
    expect(setup().chart.diameter()).toBe(200);

    TestBed.resetTestingModule();

    expect(setup({ plotWidth: 150.6 }).chart.diameter()).toBe(150);
  });

  it('lays the slices out clockwise from 12 o’clock in data order, each sweeping its share', () => {
    const { chart } = setup();
    const slices = chart.slices();

    expect(slices.map((slice) => slice.datum.label)).toEqual(['Search', 'Direct', 'Social']);
    expect(slices.map((slice) => [slice.startAngle, slice.endAngle])).toEqual([
      [0, TAU / 2],
      [TAU / 2, TAU * 0.75],
      [TAU * 0.75, TAU],
    ]);
  });

  it('points each tooltip at the middle of its slice’s outer arc, opening on that side of the circle', () => {
    const { chart, element } = setup();
    const [search, direct, social] = chart.slices();

    expect(search?.anchor.x).toBeCloseTo(200);
    expect(search?.anchor.y).toBeCloseTo(100);
    expect(search?.placement).toBe('right');
    expect(direct?.placement).toBe('left');
    expect(social?.placement).toBe('top');

    const anchors = [...element.querySelectorAll('.et-pie-chart-slice-anchor')].map((anchor) => [
      Number(anchor.getAttribute('x')),
      Number(anchor.getAttribute('y')),
    ]);

    expect(anchors[0]?.[0]).toBeCloseTo(200);
    expect(anchors[0]?.[1]).toBeCloseTo(100);
  });

  it('renders one focusable image per slice, named by its label and described by its value and share', () => {
    const { element } = setup();
    const slices = [...element.querySelectorAll('.et-pie-chart-slice')];
    const descriptions = slices.map((slice) =>
      (slice.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim())
        .join(' '),
    );

    expect(slices.map((slice) => slice.getAttribute('aria-label'))).toEqual(['Search', 'Direct', 'Social']);
    expect(descriptions).toEqual(['50 (50%)', '25 (25%)', '25 (25%)']);
    expect(slices.every((slice) => slice.getAttribute('tabindex') === '0')).toBe(true);
    expect(slices.every((slice) => slice.getAttribute('role') === 'img')).toBe(true);
    expect(element.querySelector('svg[role="group"]')?.getAttribute('aria-label')).toBe('Visits');
  });

  it('keeps a slice of 0 in the legend and the table, but draws no slice and no tab stop for it', () => {
    const { fixture, host, chart, element } = setup();

    host.data.set([
      { label: 'Search', value: 3 },
      { label: 'Direct', value: 0 },
      { label: 'Social', value: 1 },
    ]);
    fixture.detectChanges();

    expect(chart.slices().map((slice) => slice.datum.label)).toEqual(['Search', 'Social']);
    expect(element.querySelectorAll('.et-pie-chart-slice').length).toBe(2);
    expect([...element.querySelectorAll('.et-pie-chart-legend-label')].map((label) => label.textContent)).toEqual([
      'Search',
      'Direct',
      'Social',
    ]);
    expect([...element.querySelectorAll('.et-pie-chart-legend-percent')].map((cell) => cell.textContent)).toEqual([
      '75%',
      '0%',
      '25%',
    ]);
  });

  it('draws a single slice as a full disc without a gap, its tooltip at the top', () => {
    const { fixture, host, chart } = setup();

    host.data.set([
      { label: 'Search', value: 0 },
      { label: 'Direct', value: 12 },
    ]);
    fixture.detectChanges();

    const [only] = chart.slices();

    expect(chart.slices().length).toBe(1);
    expect(only?.path).toBe('M100,0A100,100 0 1 1 100,200A100,100 0 1 1 100,0Z');
    expect(only?.placement).toBe('top');
    expect(only?.percentText).toBe('100%');
  });

  it('cuts a 2px gap between neighbouring slices', () => {
    const { chart } = setup();
    const start = chart.slices()[0]?.path.match(/^M([\d.]+),([\d.]+)/);

    expect(Number(start?.[1])).toBeCloseTo(101, 2);
  });

  it('counts a negative value as 0 and warns about it in dev mode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fixture, host, chart } = setup();

    host.data.set([
      { label: 'Search', value: 3 },
      { label: 'Refunds', value: -2 },
      { label: 'Social', value: 1 },
    ]);
    fixture.detectChanges();

    expect(chart.total()).toBe(4);
    expect(chart.slices().map((slice) => slice.datum.label)).toEqual(['Search', 'Social']);
    expect(chart.entries().map((entry) => entry.percent)).toEqual([75, 0, 25]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ET5140'));

    warn.mockRestore();
  });

  it('draws an empty track and no slices when nothing is positive', () => {
    const { fixture, host, element } = setup();

    host.data.set([{ label: 'Search', value: 0 }]);
    fixture.detectChanges();

    expect(element.querySelector('.et-pie-chart-slice')).toBeNull();
    expect(element.querySelector('.et-pie-chart-empty')).not.toBeNull();
  });

  it('colors slice i with palette entry i, and steps the accent for the slices past the palette', () => {
    const { chart } = setup({ providers: [PALETTE] });

    expect(chart.entries().map((entry) => [entry.colorToken, entry.accentMix])).toEqual([
      ['ocean', null],
      ['sunset', null],
      [null, 100],
    ]);
  });

  it('steps the accent from full strength to 40% across every slice without a palette', () => {
    const { chart } = setup();

    expect(chart.entries().map((entry) => entry.accentMix)).toEqual([100, 70, 40]);
  });

  it('lets a slice’s own colorToken win over its palette entry', () => {
    const { fixture, host, chart } = setup({ providers: [PALETTE] });

    host.data.set([
      { label: 'Search', value: 1, colorToken: 'forest' },
      { label: 'Direct', value: 1 },
    ]);
    fixture.detectChanges();

    expect(chart.entries().map((entry) => entry.colorToken)).toEqual(['forest', 'sunset']);
  });

  it('shows the total in the donut hole, and projected centre content', () => {
    const { fixture, host, element } = setup();

    expect(element.querySelector('.et-pie-chart-center')).toBeNull();

    host.innerRadius.set(0.6);
    host.showTotal.set(true);
    host.center.set(true);
    fixture.detectChanges();

    expect(element.querySelector('.et-pie-chart-total')?.textContent).toBe('100');
    expect(element.querySelector('.et-pie-chart-total-label')?.textContent).toBe('Total');
    expect(element.querySelector('.et-pie-chart-center .custom-center')?.textContent).toBe('Last 30 days');
  });

  it('cuts the donut hole at innerRadius times the radius', () => {
    const { fixture, host, chart } = setup();

    host.innerRadius.set(0.6);
    fixture.detectChanges();

    expect(chart.holeRadius()).toBeCloseTo(60);
    expect(chart.slices()[0]?.path).toMatch(/A60,60 0 0 0 /);
  });

  it('mirrors the data in a table view with values and shares', () => {
    const { element } = setup();
    const header = [...element.querySelectorAll('.et-chart-table thead th')].map((cell) => cell.textContent?.trim());
    const rows = [...element.querySelectorAll('.et-chart-table tbody tr')].map((row) =>
      [...row.children].map((cell) => cell.textContent?.trim()),
    );

    expect(header).toEqual(['Category', 'Value', 'Share']);
    expect(rows).toEqual([
      ['Search', '50', '50%'],
      ['Direct', '25', '25%'],
      ['Social', '25', '25%'],
    ]);
  });

  it('draws no slices until the plot has a width', () => {
    const fixture = TestBed.createComponent(PieChartHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.et-pie-chart-slice')).toBeNull();
  });
});
