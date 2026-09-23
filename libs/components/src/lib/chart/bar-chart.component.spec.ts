import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../test-helpers';
import { BarChartComponent } from './bar-chart.component';
import { BarChartPlotDirective } from './headless/bar-chart-plot.directive';
import { BarChartDatum, BarChartDirective } from './headless/bar-chart.directive';

@Component({
  selector: 'et-test-bar-chart-host',
  template: `<et-bar-chart [data]="data()" [height]="200" label="Sign-ups" />`,
  imports: [BarChartComponent],
})
class BarChartHostComponent {
  data = signal<BarChartDatum[]>([
    { label: 'Jan', value: 40 },
    { label: 'Feb', value: 100 },
    { label: 'Mar', value: -20 },
  ]);
}

const setup = () => {
  const fixture = TestBed.createComponent(BarChartHostComponent);
  fixture.detectChanges();

  const chart = fixture.debugElement.query(By.directive(BarChartDirective)).injector.get(BarChartDirective);
  chart.plot.set({ width: signal(300) } as unknown as BarChartPlotDirective);
  fixture.detectChanges();

  return { fixture, chart, element: fixture.nativeElement as HTMLElement };
};

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

  it('renders one focusable, labelled mark per datum', () => {
    const { element } = setup();

    const bars = [...element.querySelectorAll('.et-bar-chart-bar')];

    expect(bars.map((bar) => bar.getAttribute('aria-label'))).toEqual(['Jan: 40', 'Feb: 100', 'Mar: -20']);
    expect(bars.every((bar) => bar.getAttribute('tabindex') === '0')).toBe(true);
    expect(element.querySelectorAll('.et-bar-chart-bar-mark').length).toBe(3);
  });

  it('mirrors the data in a table view', () => {
    const { element } = setup();

    const rows = [...element.querySelectorAll('.et-bar-chart-table tbody tr')].map((row) =>
      [...row.children].map((cell) => cell.textContent?.trim()),
    );

    expect(element.querySelector('.et-bar-chart-table caption')?.textContent?.trim()).toBe('Sign-ups');
    expect(rows).toEqual([
      ['Jan', '40'],
      ['Feb', '100'],
      ['Mar', '-20'],
    ]);
  });

  it('draws no marks until the plot has a width', () => {
    const fixture = TestBed.createComponent(BarChartHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.et-bar-chart-bar')).toBeNull();
  });
});
