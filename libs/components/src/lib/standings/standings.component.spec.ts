import { Component, signal } from '@angular/core';
import '../../test-helpers';
import { provideStandingsLabels } from './standings-labels';
import { STANDINGS_IMPORTS } from './standings.imports';
import { NormalizedStandingRow, StandingsZone } from './standings.types';
import { mountStandings } from './testing/standings-driver';

const row = (overrides: Partial<NormalizedStandingRow> = {}): NormalizedStandingRow => ({
  id: 'fcb',
  position: 1,
  participant: { id: 'fcb', name: 'FC Berlin', code: 'FCB', subtitle: null, emblem: null, seed: null },
  played: 10,
  wins: 8,
  ties: 1,
  losses: 1,
  points: 25,
  difference: 18,
  form: null,
  ...overrides,
});

const ROWS = [
  row(),
  row({
    id: 'neo',
    position: 2,
    participant: { id: 'neo', name: 'Neon Esports', code: 'NEO', subtitle: null, emblem: null, seed: null },
    points: 23,
  }),
  row({
    id: 'rlp',
    position: 3,
    participant: { id: 'rlp', name: 'Rote Löwen', code: 'RLP', subtitle: null, emblem: null, seed: null },
    points: 17,
  }),
];

@Component({
  template: `
    <et-standings
      [rows]="rows()"
      [zones]="zones()"
      [highlightedRowId]="highlightedRowId()"
      [showLegend]="showLegend()"
    />
  `,
  imports: [STANDINGS_IMPORTS],
})
class HostComponent {
  public rows = signal<NormalizedStandingRow[]>(ROWS);
  public zones = signal<StandingsZone[]>([]);
  public highlightedRowId = signal<string | null>(null);
  public showLegend = signal(true);
}

const create = () => mountStandings(HostComponent);

describe('StandingsComponent', () => {
  it('is a real table, with a caption and column headers', () => {
    const driver = create();

    expect(driver.query('table')).not.toBeNull();
    expect(driver.text('caption')).toBe('Standings');
    expect(driver.queryAll('thead th[scope="col"]').length).toBeGreaterThan(3);
  });

  it('makes the position a row header, since it is what identifies the row', () => {
    const positions = create()
      .queryAll('tbody th[scope="row"]')
      .map((element) => element.textContent?.trim());

    expect(positions).toEqual(['1', '2', '3']);
  });

  it('spells out every abbreviated column for assistive tech', () => {
    const driver = create();
    // The participant column is the only header that is already a word, so it is the only one without an
    // `abbr` - every abbreviation has one.
    const abbreviated = driver
      .queryAll('thead th')
      .filter((element) => element.getAttribute('data-column') !== 'participant');

    expect(abbreviated.map((element) => element.getAttribute('abbr'))).toEqual([
      'Position',
      'Played',
      'Wins',
      'Draws',
      'Losses',
      'Difference',
      'Points',
    ]);
  });

  it('draws the rows in the order given, without re-sorting them', () => {
    const driver = create();

    driver.host.rows.set([ROWS[2]!, ROWS[0]!, ROWS[1]!]);
    driver.detectChanges();

    expect(driver.queryAll('tbody th[scope="row"]').map((element) => element.textContent?.trim())).toEqual([
      '3',
      '1',
      '2',
    ]);
  });

  it('signs the difference, which is the whole point of the column', () => {
    const driver = create();

    driver.host.rows.set([row({ difference: 4 }), row({ id: 'neo', position: 2, difference: -9 })]);
    driver.detectChanges();

    expect(driver.cells('detail').filter((value) => value?.startsWith('+') || value?.startsWith('-'))).toEqual([
      '+4',
      '-9',
    ]);
  });

  it('drops the difference column when no row reports one', () => {
    const driver = create();

    driver.host.rows.set([row({ difference: null })]);
    driver.detectChanges();

    expect(driver.queryAll('thead th').map((element) => element.getAttribute('abbr'))).not.toContain('Difference');
  });

  it('drops the form column when no competition reports form', () => {
    const driver = create();

    expect(driver.queryAll('.et-standings-form')).toHaveLength(0);

    driver.host.rows.set([row({ form: ['win', 'tie', 'loss'] })]);
    driver.detectChanges();

    expect(driver.queryAll('.et-standings-form-result').map((element) => element.getAttribute('aria-label'))).toEqual([
      'Win',
      'Draw',
      'Loss',
    ]);
  });

  describe('zones', () => {
    const zoned = () => {
      const driver = create();

      driver.host.zones.set([{ from: 1, to: 2, color: 'brand', label: 'Advances' }]);
      driver.detectChanges();

      return driver;
    };

    it('band the rows they cover and no others', () => {
      const marked = zoned()
        .queryAll('tbody tr')
        .map((element) => element.hasAttribute('data-zone'));

      expect(marked).toEqual([true, true, false]);
    });

    it('say what they mean in text, so the banding is never colour-only', () => {
      expect(
        zoned()
          .queryAll('.et-standings-zone-note')
          .map((element) => element.textContent?.trim()),
      ).toEqual(['Advances', 'Advances']);
    });

    it('draw the legend from the same config, so the two cannot drift', () => {
      const driver = zoned();

      expect(driver.queryAll('.et-standings-legend-item').map((element) => element.textContent?.trim())).toEqual([
        'Advances',
      ]);

      driver.host.showLegend.set(false);
      driver.detectChanges();

      expect(driver.queryAll('.et-standings-legend')).toHaveLength(0);
    });

    it('are rejected when they overlap, whenever the overlap appears', () => {
      const driver = create();

      driver.host.zones.set([
        { from: 1, to: 2, color: 'brand', label: 'Advances' },
        { from: 2, to: 3, color: 'brand', label: 'Playoffs' },
      ]);

      expect(() => driver.detectChanges()).toThrow(/both cover a position/);
    });

    it('are absent entirely without a config', () => {
      const driver = create();

      expect(driver.queryAll('[data-zone]')).toHaveLength(0);
      expect(driver.queryAll('.et-standings-legend')).toHaveLength(0);
    });
  });

  describe('the highlighted row', () => {
    it('is marked as current, and says why', () => {
      const driver = create();

      driver.host.highlightedRowId.set('neo');
      driver.detectChanges();

      const rows = driver.queryAll('tbody tr');

      expect(rows.map((element) => element.getAttribute('aria-current'))).toEqual([null, 'true', null]);
      expect(driver.queryAll('.et-standings-zone-note').map((element) => element.textContent?.trim())).toEqual([
        'Your team',
      ]);
    });

    it('is nobody when the id matches no row', () => {
      const driver = create();

      driver.host.highlightedRowId.set('nope');
      driver.detectChanges();

      expect(driver.queryAll('[data-highlighted]')).toHaveLength(0);
    });
  });

  it('takes its strings from the standings labels', () => {
    const driver = mountStandings(HostComponent, [provideStandingsLabels({ caption: 'Tabelle', points: 'Pkt' })]);

    expect(driver.text('caption')).toBe('Tabelle');
    expect(driver.queryAll("thead [data-column='points']").map((element) => element.textContent?.trim())).toEqual([
      'Pkt',
    ]);
  });
});
