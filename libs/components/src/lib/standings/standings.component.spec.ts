import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import '../../test-helpers';
import { provideStandingsLabels } from './standings-labels';
import { STANDINGS_IMPORTS } from './standings.imports';
import { NormalizedStandingRow, StandingsZone } from './standings.types';

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

const create = () => {
  TestBed.configureTestingModule({
    providers: [
      provideColorThemesWithTailwind4([
        {
          name: 'brand',
          isDefault: true,
          primary: {
            color: { default: '0 0 0', hover: '0 0 0', active: '0 0 0', disabled: '0 0 0' },
            onColor: { default: '255 255 255' },
          },
        },
      ]),
    ],
  });

  const fixture = TestBed.createComponent(HostComponent);

  fixture.detectChanges();

  return fixture;
};

const all = (fixture: ComponentFixture<HostComponent>, selector: string) =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(selector));

const cells = (fixture: ComponentFixture<HostComponent>, column: string) =>
  all(fixture, `tbody [data-column='${column}']`).map((element) => element.textContent?.trim());

describe('StandingsComponent', () => {
  it('is a real table, with a caption and column headers', () => {
    const fixture = create();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('table')).not.toBeNull();
    expect(host.querySelector('caption')?.textContent?.trim()).toBe('Standings');
    expect(all(fixture, 'thead th[scope="col"]').length).toBeGreaterThan(3);
  });

  it('makes the position a row header, since it is what identifies the row', () => {
    const positions = all(create(), 'tbody th[scope="row"]').map((element) => element.textContent?.trim());

    expect(positions).toEqual(['1', '2', '3']);
  });

  it('spells out every abbreviated column for assistive tech', () => {
    const fixture = create();
    // The participant column is the only header that is already a word, so it is the only one without an
    // `abbr` — every abbreviation has one.
    const abbreviated = all(fixture, 'thead th').filter(
      (element) => element.getAttribute('data-column') !== 'participant',
    );

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
    const fixture = create();

    fixture.componentInstance.rows.set([ROWS[2]!, ROWS[0]!, ROWS[1]!]);
    fixture.detectChanges();

    expect(all(fixture, 'tbody th[scope="row"]').map((element) => element.textContent?.trim())).toEqual([
      '3',
      '1',
      '2',
    ]);
  });

  it('signs the difference, which is the whole point of the column', () => {
    const fixture = create();

    fixture.componentInstance.rows.set([row({ difference: 4 }), row({ id: 'neo', position: 2, difference: -9 })]);
    fixture.detectChanges();

    expect(cells(fixture, 'detail').filter((value) => value?.startsWith('+') || value?.startsWith('-'))).toEqual([
      '+4',
      '-9',
    ]);
  });

  it('drops the difference column when no row reports one', () => {
    const fixture = create();

    fixture.componentInstance.rows.set([row({ difference: null })]);
    fixture.detectChanges();

    expect(all(fixture, 'thead th').map((element) => element.getAttribute('abbr'))).not.toContain('Difference');
  });

  it('drops the form column when no competition reports form', () => {
    const fixture = create();

    expect(all(fixture, '.et-standings-form')).toHaveLength(0);

    fixture.componentInstance.rows.set([row({ form: ['win', 'tie', 'loss'] })]);
    fixture.detectChanges();

    expect(all(fixture, '.et-standings-form-result').map((element) => element.getAttribute('aria-label'))).toEqual([
      'Win',
      'Draw',
      'Loss',
    ]);
  });

  describe('zones', () => {
    const zoned = () => {
      const fixture = create();

      fixture.componentInstance.zones.set([{ from: 1, to: 2, color: 'brand', label: 'Advances' }]);
      fixture.detectChanges();

      return fixture;
    };

    it('band the rows they cover and no others', () => {
      const marked = all(zoned(), 'tbody tr').map((element) => element.hasAttribute('data-zone'));

      expect(marked).toEqual([true, true, false]);
    });

    it('say what they mean in text, so the banding is never colour-only', () => {
      expect(all(zoned(), '.et-standings-zone-note').map((element) => element.textContent?.trim())).toEqual([
        'Advances',
        'Advances',
      ]);
    });

    it('draw the legend from the same config, so the two cannot drift', () => {
      const fixture = zoned();

      expect(all(fixture, '.et-standings-legend-item').map((element) => element.textContent?.trim())).toEqual([
        'Advances',
      ]);

      fixture.componentInstance.showLegend.set(false);
      fixture.detectChanges();

      expect(all(fixture, '.et-standings-legend')).toHaveLength(0);
    });

    it('are absent entirely without a config', () => {
      const fixture = create();

      expect(all(fixture, '[data-zone]')).toHaveLength(0);
      expect(all(fixture, '.et-standings-legend')).toHaveLength(0);
    });
  });

  describe('the highlighted row', () => {
    it('is marked as current, and says why', () => {
      const fixture = create();

      fixture.componentInstance.highlightedRowId.set('neo');
      fixture.detectChanges();

      const rows = all(fixture, 'tbody tr');

      expect(rows.map((element) => element.getAttribute('aria-current'))).toEqual([null, 'true', null]);
      expect(all(fixture, '.et-standings-zone-note').map((element) => element.textContent?.trim())).toEqual([
        'Your team',
      ]);
    });

    it('is nobody when the id matches no row', () => {
      const fixture = create();

      fixture.componentInstance.highlightedRowId.set('nope');
      fixture.detectChanges();

      expect(all(fixture, '[data-highlighted]')).toHaveLength(0);
    });
  });

  it('takes its strings from the standings labels', () => {
    TestBed.configureTestingModule({ providers: [provideStandingsLabels({ caption: 'Tabelle', points: 'Pkt' })] });

    const fixture = create();

    expect((fixture.nativeElement as HTMLElement).querySelector('caption')?.textContent?.trim()).toBe('Tabelle');
    expect(all(fixture, "thead [data-column='points']").map((element) => element.textContent?.trim())).toEqual(['Pkt']);
  });
});
