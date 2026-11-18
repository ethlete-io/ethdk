import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import '../../test-helpers';
import { provideStandingsLabels } from './standings-labels';
import { STANDINGS_IMPORTS } from './standings.imports';
import { TooltipDirective } from '../tooltip';
import {
  NormalizedStandingRow,
  StandingsExtraColumn,
  StandingsParticipantLink,
  StandingsZone,
} from './standings.types';
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

    expect(driver.queryAll('.et-standings-form-note').map((element) => element.textContent?.trim())).toEqual([
      'Win',
      'Draw',
      'Loss',
    ]);
  });

  it('names each form result in text rather than on an empty element', () => {
    const driver = create();

    driver.host.rows.set([row({ form: ['win', 'loss'] })]);
    driver.detectChanges();

    expect(driver.queryAll('.et-standings-form-note').map((note) => note.textContent?.trim())).toEqual(['Win', 'Loss']);
    expect(
      driver.queryAll('.et-standings-form-result').every((dot) => dot.getAttribute('aria-hidden') === 'true'),
    ).toBe(true);
  });

  it('marks each form result with a letter, not only a fill', () => {
    const driver = create();

    driver.host.rows.set([row({ form: ['win', 'tie', 'loss'] })]);
    driver.detectChanges();

    expect(driver.queryAll('.et-standings-form-result').map((pip) => pip.textContent?.trim())).toEqual(['W', 'D', 'L']);
  });

  it('localizes the form result letters', () => {
    const driver = mountStandings(HostComponent, [
      provideStandingsLabels({ formResultShort: (result) => (result === 'win' ? 'S' : result === 'loss' ? 'N' : 'U') }),
    ]);

    driver.host.rows.set([row({ form: ['win', 'tie', 'loss'] })]);
    driver.detectChanges();

    expect(driver.queryAll('.et-standings-form-result').map((pip) => pip.textContent?.trim())).toEqual(['S', 'U', 'N']);
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

    it('draw one legend entry per zone, even when two share a label', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const driver = zoned();

      driver.host.zones.set([
        { from: 1, to: 1, color: 'brand', label: 'Advances' },
        { from: 2, to: 2, color: 'brand', label: 'Playoffs' },
        { from: 3, to: 3, color: 'brand', label: 'Advances' },
      ]);
      driver.detectChanges();
      driver.host.zones.update((zones) => [...zones].reverse());
      driver.detectChanges();

      expect(driver.queryAll('.et-standings-legend-item')).toHaveLength(3);
      expect(warn.mock.calls.flat().join(' ')).not.toContain('NG0955');

      warn.mockRestore();
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

describe('StandingsComponent ties', () => {
  it('draws rows sharing a position in the order given', () => {
    const driver = create();

    driver.host.rows.set([ROWS[0]!, { ...ROWS[2]!, position: 2 }, { ...ROWS[1]!, position: 2 }]);
    driver.detectChanges();

    expect(driver.queryAll('tbody tr').map((element) => element.textContent?.includes('Rote Löwen'))).toEqual([
      false,
      true,
      false,
    ]);
    expect(driver.queryAll('tbody th[scope="row"]').map((element) => element.textContent?.trim())).toEqual([
      '1',
      '2',
      '2',
    ]);
  });
});

@Component({
  template: `
    <et-standings
      [(expandedRows)]="expandedRows"
      [rows]="rows"
      [expandMode]="expandMode()"
      (click)="clicks = clicks + 1"
    >
      <ng-template let-row let-columnCount="columnCount" etStandingsRowDetail>
        <tr class="season-row">
          <td [attr.colspan]="columnCount">
            <button class="season-button" type="button">{{ row.participant?.name }} 2025</button>
          </td>
        </tr>
      </ng-template>
    </et-standings>
  `,
  imports: [STANDINGS_IMPORTS],
})
class ExpandableHostComponent {
  public rows = ROWS;
  public expandMode = signal<'single' | 'multiple'>('multiple');
  public expandedRows = signal<readonly string[]>([]);
  public clicks = 0;
}

describe('StandingsComponent row detail', () => {
  const toggles = (driver: ReturnType<typeof createExpandable>) =>
    driver.queryAll<HTMLButtonElement>('.et-standings-expand-toggle');

  const createExpandable = () => mountStandings(ExpandableHostComponent);

  it('adds no toggle column, no extra tbody and no aria without the template', () => {
    const driver = create();

    expect(driver.queryAll('[data-column="expand"]').length).toBe(0);
    expect(driver.queryAll('tbody').length).toBe(1);
    expect(driver.queryAll('[aria-expanded]').length).toBe(0);
  });

  it('gives every row a labelled toggle that controls its detail', () => {
    const driver = createExpandable();
    const [first] = toggles(driver);

    expect(toggles(driver).length).toBe(3);
    expect(driver.queryAll('thead [data-column="expand"]').length).toBe(1);
    expect(first!.getAttribute('aria-label')).toBe('Details for FC Berlin');
    expect(first!.getAttribute('aria-expanded')).toBe('false');
    expect(driver.query('.season-row')).toBeNull();

    driver.click(first!);

    expect(first!.getAttribute('aria-expanded')).toBe('true');
    const detail = driver.query('.et-standings-detail');
    expect(detail?.id).toBe(first!.getAttribute('aria-controls'));
    expect(detail?.querySelector('td')?.getAttribute('colspan')).toBe('9');
    expect(driver.text('.season-button')).toBe('FC Berlin 2025');
  });

  it('keeps the toggle click away from a click handler on the table', () => {
    const driver = createExpandable();

    driver.click(toggles(driver)[0]!);

    expect(driver.host.clicks).toBe(0);
  });

  it('opens rows independently by default', () => {
    const driver = createExpandable();

    driver.click(toggles(driver)[0]!);
    driver.click(toggles(driver)[1]!);

    expect(driver.host.expandedRows()).toEqual(['fcb', 'neo']);
  });

  it('closes the open row when another one opens in single mode', () => {
    const driver = createExpandable();
    driver.host.expandMode.set('single');
    driver.detectChanges();

    driver.click(toggles(driver)[0]!);
    driver.click(toggles(driver)[1]!);

    expect(driver.host.expandedRows()).toEqual(['neo']);
    expect(toggles(driver).map((toggle) => toggle.getAttribute('aria-expanded'))).toEqual(['false', 'true', 'false']);
  });

  it('closes an open row on a second click', () => {
    const driver = createExpandable();

    driver.click(toggles(driver)[0]!);
    driver.click(toggles(driver)[0]!);

    expect(driver.host.expandedRows()).toEqual([]);
    expect(toggles(driver)[0]!.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the rows bound through expandedRows', () => {
    const driver = createExpandable();

    driver.host.expandedRows.set(['rlp']);
    driver.detectChanges();

    expect(toggles(driver).map((toggle) => toggle.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true']);
    expect(driver.text('.season-button')).toBe('Rote Löwen 2025');
  });
});

@Component({
  template: `<et-standings [rows]="rows" [zones]="zones" highlightedRowId="neo" />`,
  imports: [STANDINGS_IMPORTS],
})
class DefaultsHostComponent {
  public rows = [row({ form: ['win', 'tie', 'loss'] }), ...ROWS.slice(1)];
  public zones: StandingsZone[] = [{ from: 1, to: 1, color: 'brand', label: 'Advances' }];
}

describe('StandingsComponent without the optional extras', () => {
  it('renders the same DOM as before the extras existed', () => {
    const driver = mountStandings(DefaultsHostComponent);

    expect(driver.fixture.nativeElement.innerHTML.replace(/<!--[\s\S]*?-->/g, '')).toMatchSnapshot();
  });
});

@Component({
  template: ` <et-standings [rows]="rows()" [extraColumns]="extraColumns()" [participantLink]="participantLink()" /> `,
  imports: [STANDINGS_IMPORTS],
})
class ExtrasHostComponent {
  public rows = signal<NormalizedStandingRow[]>(ROWS);
  public extraColumns = signal<StandingsExtraColumn[]>([]);
  public participantLink = signal<((row: NormalizedStandingRow) => StandingsParticipantLink | null) | null>(null);
}

describe('StandingsComponent extras', () => {
  it('adds the extra columns after the built-in stats, with headers and values', () => {
    const driver = mountStandings(ExtrasHostComponent);

    driver.host.extraColumns.set([
      { key: 'for', label: 'F', labelFull: 'Scored' },
      { key: 'against', label: 'A' },
    ]);
    driver.host.rows.set([
      row({ extraStats: { for: 24, against: 6 } }),
      row({ id: 'neo', position: 2, extraStats: { for: 0 } }),
    ]);
    driver.detectChanges();

    const headers = driver.queryAll('thead th');
    const forHeader = driver.query('thead th[data-extra-column="for"]');

    expect(forHeader?.textContent?.trim()).toBe('F');
    expect(forHeader?.getAttribute('abbr')).toBe('Scored');
    expect(driver.query('thead th[data-extra-column="against"]')?.hasAttribute('abbr')).toBe(false);
    expect(headers.indexOf(forHeader as HTMLElement)).toBe(
      headers.findIndex((header) => header.getAttribute('data-column') === 'points') - 2,
    );
    expect(forHeader?.getAttribute('data-column')).toBe('detail');
    expect(driver.queryAll('tbody td[data-extra-column]').map((cell) => cell.textContent?.trim())).toEqual([
      '24',
      '6',
      '0',
      '',
    ]);
  });

  it('shows a form label as a tooltip and reads it as the result name', () => {
    const driver = mountStandings(ExtrasHostComponent);

    driver.host.rows.set([row({ form: ['win', { result: 'loss', label: 'vs Neon Esports 1:2' }] })]);
    driver.detectChanges();

    const [plain, labelled] = driver.queryAll('.et-standings-form-result');

    expect(plain?.getAttribute('aria-hidden')).toBe('true');
    expect(labelled?.getAttribute('role')).toBe('img');
    expect(labelled?.getAttribute('aria-label')).toBe('Loss: vs Neon Esports 1:2');
    expect(labelled?.hasAttribute('aria-hidden')).toBe(false);
    expect(labelled?.textContent?.trim()).toBe('L');
    expect(driver.queryAll('.et-standings-form-note').map((note) => note.textContent?.trim())).toEqual(['Win']);
    expect(driver.fixture.debugElement.query(By.directive(TooltipDirective))?.nativeElement).toBe(labelled);
  });

  it('links the participant to an href', () => {
    const driver = mountStandings(ExtrasHostComponent);

    driver.host.participantLink.set((standingRow) => (standingRow.id === 'neo' ? null : `/teams/${standingRow.id}`));
    driver.detectChanges();

    const links = driver.queryAll<HTMLAnchorElement>('a.et-standings-participant');

    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/teams/fcb', '/teams/rlp']);
    expect(driver.queryAll('et-match-participant.et-standings-participant').length).toBe(1);
  });

  it('links the participant through routerLink for router commands', () => {
    const driver = mountStandings(ExtrasHostComponent, [provideRouter([])]);

    driver.host.participantLink.set((standingRow) => ['/teams', standingRow.id]);
    driver.detectChanges();

    expect(
      driver.queryAll<HTMLAnchorElement>('a.et-standings-participant').map((link) => link.getAttribute('href')),
    ).toEqual(['/teams/fcb', '/teams/neo', '/teams/rlp']);
  });

  it('never links a TBD slot', () => {
    const driver = mountStandings(ExtrasHostComponent);

    driver.host.rows.set([row({ participant: null })]);
    driver.host.participantLink.set(() => '/teams/x');
    driver.detectChanges();

    expect(driver.query('a.et-standings-participant')).toBeNull();
  });
});
