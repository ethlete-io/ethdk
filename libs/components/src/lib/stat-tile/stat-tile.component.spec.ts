import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import '../../test-helpers';
import { StatTileFormat, StatTileGoodDirection } from './stat-tile.types';
import { STAT_TILE_IMPORTS } from './stat-tile.imports';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'ok', type: 'success', primary: swatch('0 160 60') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
];

@Component({
  selector: 'et-test-stat-tile-host',
  template: `
    <et-stat-tile
      [value]="value()"
      [unit]="unit()"
      [delta]="delta()"
      [deltaFormat]="deltaFormat()"
      [goodDirection]="goodDirection()"
      [caption]="caption()"
      [loading]="loading()"
      label="Latency"
    />
  `,
  imports: [STAT_TILE_IMPORTS],
})
class StatTileHostComponent {
  value = signal<number | string | null>(1284);
  unit = signal<string | null>(null);
  delta = signal<number | null>(null);
  deltaFormat = signal<StatTileFormat | null>(null);
  goodDirection = signal<StatTileGoodDirection | null>('up');
  caption = signal<string | null>(null);
  loading = signal(false);
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('StatTileComponent', () => {
  const setup = () => {
    TestBed.configureTestingModule({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

    const fixture = TestBed.createComponent(StatTileHostComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement.querySelector('et-stat-tile') as HTMLElement;
    const render = () => fixture.detectChanges();

    return { app: fixture.componentInstance, host, render };
  };

  it('reads label, value and unit as one sentence', () => {
    const { app, host, render } = setup();

    app.unit.set('ms');
    render();

    expect(text(host.querySelector('.et-stat-tile-label'))).toBe('Latency');
    expect(text(host.querySelector('.et-stat-tile-value'))).toBe('1,284 ms');
    expect(host.querySelector('.et-stat-tile-footer')).toBeNull();
  });

  it('shows a string value as given and a null value as a labelled dash', () => {
    const { app, host, render } = setup();

    app.value.set('n/a');
    render();
    expect(text(host.querySelector('.et-stat-tile-value'))).toBe('n/a');

    app.value.set(null);
    render();
    expect(text(host.querySelector('.et-stat-tile-value [aria-hidden="true"]'))).toBe('–');
    expect(text(host.querySelector('.et-stat-tile-value .et-visually-hidden'))).toBe('No value');
  });

  it('signs the delta, names its direction and colours it by whether that direction is good', () => {
    const { app, host, render } = setup();

    app.delta.set(0.124);
    app.deltaFormat.set({ style: 'percent', maximumFractionDigits: 1 });
    app.caption.set('vs last week');
    render();

    const delta = () => host.querySelector('.et-stat-tile-delta') as HTMLElement;

    expect(text(host.querySelector('.et-stat-tile-footer'))).toBe('Up +12.4% vs last week');
    expect(delta().dataset['direction']).toBe('up');
    expect(delta().dataset['sentiment']).toBe('good');
    expect(delta().classList).toContain('et-color--ok');

    app.goodDirection.set('down');
    render();
    expect(delta().dataset['sentiment']).toBe('bad');
    expect(delta().classList).toContain('et-color--alert');

    app.delta.set(-0.05);
    render();
    expect(text(delta())).toBe('Down -5%');
    expect(delta().dataset['sentiment']).toBe('good');

    app.delta.set(0);
    render();
    expect(text(delta())).toBe('Unchanged 0%');
    expect(delta().dataset['sentiment']).toBe('neutral');
    expect(delta().classList).toContain('et-color--inherited');

    app.goodDirection.set(null);
    app.delta.set(3);
    render();
    expect(delta().dataset['sentiment']).toBe('neutral');
  });

  it('swaps the value and delta for a skeleton while loading, keeping the label', () => {
    const { app, host, render } = setup();

    app.delta.set(2);
    app.loading.set(true);
    render();

    expect(host.getAttribute('aria-busy')).toBe('true');
    expect(text(host.querySelector('.et-stat-tile-label'))).toBe('Latency');
    expect(host.querySelector('.et-stat-tile-value')).toBeNull();
    expect(host.querySelector('.et-stat-tile-delta')).toBeNull();
    expect(host.querySelector('et-skeleton')?.getAttribute('role')).toBe('status');

    app.loading.set(false);
    render();
    expect(host.hasAttribute('aria-busy')).toBe(false);
    expect(text(host.querySelector('.et-stat-tile-value'))).toBe('1,284');
  });
});
