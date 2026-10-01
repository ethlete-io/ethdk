import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, injectLocale, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import { map, timer } from 'rxjs';
import {
  DEFAULT_STAT_TILE_LABELS,
  injectStatTileLabels,
  provideStatTileLabels,
  STAT_TILE_IMPORTS,
  STAT_TILE_LABELS,
  StatTileComponent,
  StatTileFormat,
  StatTileSparklineComponent,
} from '../index';
import '../test-helpers';
import { useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'ok', type: 'success', primary: swatch('0 160 60') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
];

type Kpis = { revenue: number; revenueDelta: number; latency: number; latencyDelta: number; latencyTrend: number[] };

const KPIS: Kpis = {
  revenue: 4_210_000,
  revenueDelta: 0.124,
  latency: 212,
  latencyDelta: 18,
  latencyTrend: [180, 196, 188, 212],
};

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const tile = (host: HTMLElement, label: string) => {
  const found = Array.from(host.querySelectorAll('et-stat-tile')).find(
    (element) => text(element.querySelector('.et-stat-tile-label')) === label,
  );

  if (!found) throw new Error(`No tile ${label}`);

  return found as HTMLElement;
};

@Component({
  selector: 'et-scenario-kpi-row',
  imports: [STAT_TILE_IMPORTS],
  template: `
    <et-stat-tile
      [value]="kpis()?.revenue ?? null"
      [format]="currency"
      [delta]="kpis()?.revenueDelta ?? null"
      [deltaFormat]="{ style: 'percent', maximumFractionDigits: 1 }"
      [loading]="!kpis()"
      caption="vs last month"
      label="Revenue"
    />
    <et-stat-tile
      [value]="kpis()?.latency ?? null"
      [delta]="kpis()?.latencyDelta ?? null"
      [loading]="!kpis()"
      caption="vs last month"
      goodDirection="down"
      label="p95 latency"
      unit="ms"
    >
      @if (kpis(); as kpis) {
        <et-stat-tile-sparkline [values]="kpis.latencyTrend" />
      }
    </et-stat-tile>
  `,
})
class KpiRowComponent {
  kpis = toSignal(timer(500).pipe(map(() => KPIS)));
  currency: StatTileFormat = { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 };
}

@Component({
  selector: 'et-scenario-untinted-tile',
  imports: [StatTileComponent, StatTileSparklineComponent],
  template: `
    <et-stat-tile [value]="12940" [delta]="-310" [goodDirection]="null" label="Page views">
      <et-stat-tile-sparkline [values]="[3, 5, 4]" />
    </et-stat-tile>
    <et-stat-tile [value]="1284" [delta]="0" label="Open tickets" />
    <span class="probe">{{ labels().unchanged }}|{{ token.unchanged }}</span>
  `,
})
class UntintedTileComponent {
  labels = injectStatTileLabels();
  token = inject(STAT_TILE_LABELS);
}

describe('stat tile scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

  it('holds a skeleton until the data arrives, then reads each tile as one sentence', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(KpiRowComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    s.frame();

    const revenue = tile(host, 'Revenue');
    const latency = tile(host, 'p95 latency');

    expect(revenue.getAttribute('aria-busy')).toBe('true');
    expect(revenue.querySelector('et-skeleton')?.getAttribute('role')).toBe('status');
    expect(revenue.querySelector('.et-stat-tile-value')).toBeNull();
    expect(latency.querySelector('et-stat-tile-sparkline')).toBeNull();

    s.tick(500);
    s.flush();

    expect(revenue.hasAttribute('aria-busy')).toBe(false);
    expect(revenue.querySelector('et-skeleton')).toBeNull();
    expect(text(revenue)).toBe(`Revenue $4.2M ${DEFAULT_STAT_TILE_LABELS.up} +12.4% vs last month`);
    expect(text(latency)).toBe('p95 latency 212 ms Up +18 vs last month');

    const revenueDelta = revenue.querySelector<HTMLElement>('.et-stat-tile-delta');
    const latencyDelta = latency.querySelector<HTMLElement>('.et-stat-tile-delta');

    expect(revenueDelta?.dataset['sentiment']).toBe('good');
    expect(revenueDelta?.classList).toContain('et-color--ok');
    expect(latencyDelta?.dataset['sentiment']).toBe('bad');
    expect(latencyDelta?.classList).toContain('et-color--alert');
    expect(latencyDelta?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');

    const sparkline = latency.querySelector('et-stat-tile-sparkline');

    expect(sparkline?.getAttribute('aria-hidden')).toBe('true');
    expect(sparkline?.querySelector('.et-stat-tile-sparkline-line')?.getAttribute('d')).toBe(
      'M0,28L33.33,16L66.67,22L100,4',
    );
    expect(s.errors).toEqual([]);
  });
});

describe('stat tile scenarios without semantic themes', () => {
  const scenario = useScenario({
    providers: [
      provideColorThemesWithTailwind4([COLOR_THEMES[0] as ColorTheme]),
      provideStatTileLabels({ unchanged: 'Unverändert' }),
    ],
  });

  it('renders neutral deltas without a success or error theme, localized', () => {
    const s = scenario();

    TestBed.runInInjectionContext(() => injectLocale().currentLocale.set('de'));

    const fixture = TestBed.createComponent(UntintedTileComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    s.flush();

    expect(text(tile(host, 'Page views'))).toBe('Page views 12.940 Down -310');
    expect(text(tile(host, 'Open tickets'))).toBe('Open tickets 1.284 Unverändert 0');
    expect(text(host.querySelector('.probe'))).toBe('Unverändert|Unverändert');
    expect(
      Array.from(host.querySelectorAll<HTMLElement>('.et-stat-tile-delta')).map((delta) => delta.dataset['sentiment']),
    ).toEqual(['neutral', 'neutral']);
    expect(s.errors).toEqual([]);
  });
});
