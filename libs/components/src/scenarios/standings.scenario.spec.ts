import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import {
  DEFAULT_STANDINGS_LABELS,
  EthleteGroupRankingInput,
  injectStandingsLabels,
  NormalizedMatchParticipant,
  normalizeEthleteGroupRanking,
  normalizeEthletePlacement,
  provideStandingsLabels,
  STANDINGS_ERROR_CODES,
  STANDINGS_IMPORTS,
  STANDINGS_LABELS,
  STANDINGS_PICK_IMPORTS,
  StandingPick,
  StandingsComponent,
  StandingsDirective,
  StandingsPickComponent,
  StandingsPickDirective,
  StandingsPickMarkDirective,
  StandingsZone,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const participant = (id: string, name: string) => ({ id, name, code: null, emblem: null });

const GROUP: EthleteGroupRankingInput = {
  groupName: 'Group A',
  qualifiedPlayers: 2,
  placements: [
    {
      participant: participant('team-a', 'Team A'),
      position: 1,
      score: 9,
      wins: 3,
      ties: 0,
      losses: 0,
      ownPoints: 7,
      enemyPoints: 2,
      gameAmount: 3,
    },
    {
      participant: participant('team-b', 'Team B'),
      position: 2,
      score: 4,
      wins: 1,
      ties: 1,
      losses: 1,
      ownPoints: 4,
      enemyPoints: 4,
      gameAmount: 3,
    },
    {
      participant: participant('team-c', 'Team C'),
      position: 3,
      score: 3,
      wins: 1,
      ties: 0,
      losses: 2,
      ownPoints: 3,
      enemyPoints: 5,
      gameAmount: 3,
    },
    {
      participant: null,
      position: 4,
      score: 1,
      wins: 0,
      ties: 1,
      losses: 2,
      ownPoints: 1,
      enemyPoints: 4,
      gameAmount: 3,
    },
  ],
};

const RELEGATION: StandingsZone = { from: 4, to: 4, color: 'red', label: 'Relegated' };

const TEAMS: NormalizedMatchParticipant[] = ['a', 'b', 'c', 'd'].map((letter) => ({
  id: `team-${letter}`,
  name: `Team ${letter.toUpperCase()}`,
  code: null,
  subtitle: null,
  emblem: null,
  seed: null,
}));

@Component({
  selector: 'et-scenario-group-table',
  imports: [STANDINGS_IMPORTS],
  providers: [provideStandingsLabels({ participant: 'Club', points: 'Pkt', pointsFull: 'Punkte' })],
  template: `
    <et-standings
      [rows]="rows()"
      [zones]="zones()"
      [labels]="{ caption: standings.caption }"
      [showLegend]="showLegend()"
      highlightedRowId="team-b"
    />
  `,
})
class GroupTableComponent {
  standings = normalizeEthleteGroupRanking({ group: GROUP, advancingColor: 'sunshine', advancingLabel: 'Playoffs' });
  zones = signal<StandingsZone[]>([...this.standings.zones, RELEGATION]);
  showLegend = signal(true);
  rows = signal(
    this.standings.rows.map((row) =>
      row.id === 'team-a' ? { ...row, form: ['win' as const, 'tie' as const, 'loss' as const] } : row,
    ),
  );
  labels = injectStandingsLabels();
}

@Component({
  selector: 'et-scenario-plain-table',
  imports: [StandingsComponent],
  providers: [{ provide: STANDINGS_LABELS, useValue: () => ({ caption: 'Tabelle' }) }],
  template: '<et-standings [rows]="rows" />',
})
class PlainTableComponent {
  rows = GROUP.placements.map(normalizeEthletePlacement).map((row) => ({ ...row, difference: null }));
}

@Component({
  selector: 'et-scenario-standing-cards',
  imports: [StandingsDirective],
  template: `
    <section #table="etStandings" [rows]="rows" [zones]="zones" etStandings highlightedRowId="team-c">
      <h2>{{ table.resolvedLabels().caption }}</h2>
      @for (entry of table.renderRows(); track entry.row.id) {
        <article [attr.data-zone]="entry.zone?.label ?? null" [class.mine]="entry.isHighlighted" class="card">
          {{ entry.row.position }}. {{ entry.row.participant?.name ?? 'Open slot' }} - {{ entry.row.points }}
        </article>
      }
      <p class="columns">{{ table.hasForm() }} {{ table.hasDifference() }} {{ table.legendZones().length }}</p>
    </section>
  `,
})
class StandingCardsComponent {
  rows = GROUP.placements.map(normalizeEthletePlacement);
  zones = [RELEGATION];
}

@Component({
  selector: 'et-scenario-overlapping-zones',
  imports: [StandingsComponent],
  template: '<et-standings [rows]="rows" [zones]="zones" />',
})
class OverlappingZonesComponent {
  rows = GROUP.placements.map(normalizeEthletePlacement);
  zones: StandingsZone[] = [
    { from: 1, to: 2, color: 'sunshine', label: 'Playoffs' },
    { from: 2, to: 3, color: 'red', label: 'Play-in' },
  ];
}

@Component({
  selector: 'et-scenario-group-pick',
  imports: [STANDINGS_PICK_IMPORTS],
  template: `
    <et-standings-pick
      [(order)]="order"
      [participants]="teams"
      [storedPicks]="stored"
      [locked]="locked()"
      [labels]="{ pickCaption: 'Group A prediction' }"
      advancingCount="2"
    >
      <ng-template let-row let-index="index" etStandingsPickMark>
        <span class="points">{{ index }}:{{ row.participant.id }}{{ row.isAdvancing ? '+' : '' }}</span>
      </ng-template>
    </et-standings-pick>
  `,
})
class GroupPickComponent {
  teams = TEAMS;
  stored: StandingPick[] = [{ position: 1, participantId: 'team-c' }];
  order = signal<readonly string[] | null>(null);
  locked = signal(false);
}

@Component({
  selector: 'et-scenario-pick-cards',
  imports: [StandingsPickDirective],
  template: `
    <ul #pick="etStandingsPick" [participants]="teams" [advancingCount]="1" etStandingsPick>
      @for (row of pick.rows(); track row.participant.id; let index = $index) {
        <li [class.cut]="row.isLastAdvancing">
          {{ row.position }} {{ row.participant.name }}
          <button (click)="pick.move({ from: index, to: 0 })" type="button">Top</button>
        </li>
      }
    </ul>
    <p class="start">{{ pick.startOrder().join(',') }} / {{ pick.resolvedOrder().join(',') }}</p>
  `,
})
class PickCardsComponent {
  teams = TEAMS.slice(0, 3);
}

@Component({
  selector: 'et-scenario-duplicate-mark',
  imports: [StandingsPickComponent, StandingsPickMarkDirective],
  template: `
    <et-standings-pick [participants]="teams">
      <ng-template etStandingsPickMark>one</ng-template>
      <ng-template etStandingsPickMark>two</ng-template>
    </et-standings-pick>
  `,
})
class DuplicateMarkComponent {
  teams = TEAMS;
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const dropErrorContext = (s: Scenario) => {
  s.tick(1);

  const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

  if (index !== -1) s.errors.splice(index, 1);
};

describe('standings scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });

  it('draws a group ranking from the API with zones, a highlighted row, form and a legend', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(GroupTableComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    expect(app.labels()).toEqual({
      ...DEFAULT_STANDINGS_LABELS,
      participant: 'Club',
      points: 'Pkt',
      pointsFull: 'Punkte',
    });
    expect(text(query('caption', host))).toBe('Group A');

    const headers = queryAll('thead th', host);

    expect(headers.map(text)).toEqual(['#', 'Club', 'P', 'W', 'D', 'L', 'Diff', 'Pkt', 'Form']);
    expect(headers.map((header) => header.getAttribute('abbr'))).toEqual([
      'Position',
      null,
      'Played',
      'Wins',
      'Draws',
      'Losses',
      'Difference',
      'Punkte',
      'Recent form, oldest first',
    ]);

    const rows = queryAll('tbody tr', host);

    expect(rows.map((row) => text(row.querySelector('.et-match-participant-name')))).toEqual([
      'Team A',
      'Team B',
      'Team C',
      'TBD',
    ]);
    expect(rows.map((row) => queryAll('td[data-column="detail"]', row).at(-1)?.textContent?.trim())).toEqual([
      '+5',
      '0',
      '-2',
      '-3',
    ]);
    expect(rows.map((row) => queryAll('th .et-standings-zone-note', row).map(text))).toEqual([
      ['Playoffs'],
      ['Playoffs', 'Your team'],
      [],
      ['Relegated'],
    ]);
    expect(rows.map((row) => row.hasAttribute('data-zone'))).toEqual([true, true, false, true]);
    expect(rows[1]!.getAttribute('aria-current')).toBe('true');
    expect(queryAll('.et-standings-form-result', rows[0]).map((result) => result.getAttribute('aria-label'))).toEqual([
      'Win',
      'Draw',
      'Loss',
    ]);
    expect(queryAll('.et-standings-form-result', rows[1])).toHaveLength(0);

    const legend = query('.et-standings-legend', host);

    expect(legend.getAttribute('aria-label')).toBe(DEFAULT_STANDINGS_LABELS.legend);
    expect(queryAll('li', legend).map(text)).toEqual(['Playoffs', 'Relegated']);

    app.showLegend.set(false);
    s.tick();
    expect(host.querySelector('.et-standings-legend')).toBeNull();

    app.zones.set([]);
    s.tick();
    expect(queryAll('tbody tr[data-zone]', host)).toHaveLength(0);
    expect(host.querySelector('et-standings')?.hasAttribute('data-has-zones')).toBe(false);
  });

  it('drops the columns no row reports and reads strings from a raw STANDINGS_LABELS provider', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlainTableComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    s.flush();

    expect(text(query('caption', host))).toBe('Tabelle');
    expect(queryAll('thead th', host).map(text)).toEqual(['#', 'Team', 'P', 'W', 'D', 'L', 'Pts']);
    expect(host.querySelector('.et-standings-legend')).toBeNull();
    expect(queryAll('tbody tr', host)).toHaveLength(4);
  });

  it('builds cards from the headless standings state', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StandingCardsComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    s.flush();

    expect(text(query('h2', host))).toBe('Standings');
    expect(queryAll('.card', host).map(text)).toEqual([
      '1. Team A - 9',
      '2. Team B - 4',
      '3. Team C - 3',
      '4. Open slot - 1',
    ]);
    expect(text(query('.mine', host))).toBe('3. Team C - 3');
    expect(queryAll('.card[data-zone="Relegated"]', host).map(text)).toEqual(['4. Open slot - 1']);
    expect(text(query('.columns', host))).toBe('false true 1');
    expect(query('section', host).hasAttribute('data-has-zones')).toBe(true);
  });

  it('reports zones that cover the same position', () => {
    const s = scenario();

    TestBed.createComponent(OverlappingZonesComponent);

    expect(() => s.tick()).toThrow('The zones "Playoffs" (1-2) and "Play-in" (2-3) both cover a position');
    dropErrorContext(s);
  });

  it('reorders a pick list by keyboard from the stored picks and locks it', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(GroupPickComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const names = () => queryAll('.et-standings-pick-participant .et-match-participant-name', host).map(text);

    expect(query('ol', host).getAttribute('aria-label')).toBe('Group A prediction');
    expect(names()).toEqual(['Team C', 'Team A', 'Team B', 'Team D']);
    expect(queryAll('.points', host).map(text)).toEqual(['0:team-c+', '1:team-a+', '2:team-b', '3:team-d']);
    expect(queryAll('.et-standings-pick-item', host).map((item) => item.hasAttribute('data-advancing'))).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(text(query('.et-standings-pick-cut', host))).toBe('Advancing');
    expect(
      queryAll('.et-standings-pick-item', host).findIndex((item) => item.querySelector('.et-standings-pick-cut')),
    ).toBe(1);

    const handles = () => queryAll<HTMLButtonElement>('.et-standings-pick-handle', host);

    expect(handles()[2]!.getAttribute('aria-label')).toBe('Move Team B. Drag it, or use the arrow keys.');

    s.keydown('ArrowUp', handles()[2]);
    s.tick();
    expect(app.order()).toEqual(['team-c', 'team-b', 'team-a', 'team-d']);
    expect(names()).toEqual(['Team C', 'Team B', 'Team A', 'Team D']);

    s.keydown('ArrowUp', handles()[0]);
    s.keydown('ArrowDown', handles()[3]);
    s.tick();
    expect(app.order()).toEqual(['team-c', 'team-b', 'team-a', 'team-d']);

    app.order.set(null);
    s.tick();
    expect(names()).toEqual(['Team C', 'Team A', 'Team B', 'Team D']);

    app.locked.set(true);
    s.tick();

    expect(handles()).toHaveLength(0);
    expect(query('et-standings-pick', host).hasAttribute('data-locked')).toBe(true);
    expect(queryAll('.et-standings-pick-note', host).map(text)).toContain(DEFAULT_STANDINGS_LABELS.pickLocked);
  });

  it('drives a headless pick list through its move api', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PickCardsComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    s.flush();

    const items = () => queryAll('li', host).map((item) => text(item).replace(' Top', ''));

    expect(items()).toEqual(['1 Team A', '2 Team B', '3 Team C']);
    expect(text(query('li.cut', host))).toContain('Team A');

    queryAll<HTMLButtonElement>('li button', host)[2]!.click();
    s.tick();

    expect(items()).toEqual(['1 Team C', '2 Team A', '3 Team B']);
    expect(text(query('.start', host))).toBe('team-a,team-b,team-c / team-c,team-a,team-b');
  });

  it('refuses a second mark template on one pick list', () => {
    const s = scenario();

    expect(() => {
      TestBed.createComponent(DuplicateMarkComponent);
      s.tick();
    }).toThrow(`ET${STANDINGS_ERROR_CODES.DUPLICATE_MARK_TEMPLATE}`);
    dropErrorContext(s);
  });
});
