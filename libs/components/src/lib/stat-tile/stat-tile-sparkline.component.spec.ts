import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { StatTileSparklineComponent } from './stat-tile-sparkline.component';

@Component({
  selector: 'et-test-sparkline-host',
  template: `<et-stat-tile-sparkline [values]="values()" />`,
  imports: [StatTileSparklineComponent],
})
class SparklineHostComponent {
  values = signal<readonly (number | null)[]>([0, 10, 5]);
}

describe('StatTileSparklineComponent', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(SparklineHostComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const line = () => host.querySelector('.et-stat-tile-sparkline-line')?.getAttribute('d');
    const current = () => host.querySelector('.et-stat-tile-sparkline-current')?.getAttribute('d') ?? null;

    return { app: fixture.componentInstance, fixture, host, line, current };
  };

  it('fits the series to the box and marks the last value', () => {
    const { host, line, current } = setup();

    expect(line()).toBe('M0,28L50,4L100,16');
    expect(current()).toBe('M100,16h0');
    expect(host.querySelector('et-stat-tile-sparkline')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('breaks the line at a gap and marks the last value that exists', () => {
    const { app, fixture, line, current } = setup();

    app.values.set([2, 4, null, 4, 2, null]);
    fixture.detectChanges();

    expect(line()).toBe('M0,28L20,4M60,4L80,28');
    expect(current()).toBe('M80,28h0');
  });

  it('centres a flat series and draws nothing for an empty one', () => {
    const { app, fixture, line, current } = setup();

    app.values.set([7, 7]);
    fixture.detectChanges();
    expect(line()).toBe('M0,16L100,16');

    app.values.set([]);
    fixture.detectChanges();
    expect(line()).toBe('');
    expect(current()).toBeNull();
  });
});
