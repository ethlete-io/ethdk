import { Component, input, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BRACKET_DATA_LAYOUT,
  BRACKET_DEFAULT_CARDS,
  BRACKET_DEFAULTS,
  BRACKET_ERROR_CODES,
  BRACKET_ROUND_MIRROR_TYPE,
  BRACKET_SWISS_GROUP_COLOR_TYPE,
  BracketComponent,
  BracketDataSource,
  BracketLayout,
  BracketMap,
  BracketMatchComponent,
  BRACKET_ROUNDS_LIST_IMPORTS,
  BracketRoundsListComponent,
  bracketFitsWidth,
  bracketNaturalWidth,
  COMMON_BRACKET_ROUND_TYPE,
  createBracket,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
  doubleEliminationBracketLayout,
  EthleteRoundWithMatchesInput,
  generateBracketDataForEthlete,
  generateRoundTypeFromEthleteRoundType,
  generateTournamentModeFromEthleteRounds,
  GROUP_BRACKET_ROUND_TYPE,
  mirroredDoubleEliminationBracketLayout,
  mirroredSingleEliminationBracketLayout,
  NormalizedMatch,
  provideBracketConfig,
  provideBracketLabels,
  resolveBracketLayout,
  SINGLE_ELIMINATION_BRACKET_ROUND_TYPE,
  singleEliminationBracketLayout,
  SWISS_BRACKET_ROUND_TYPE,
  swissBracketLayout,
  TOURNAMENT_MODE,
} from '../index';
import '../test-helpers';
import { useScenario } from './harness';

type Source = BracketDataSource<null, null>;
type Side = 'home' | 'away' | null;
type MatchRow = [id: string, home: string, away: string, winner?: Side];
type RoundRow = { id: string; type: Source['rounds'][number]['type']; matches: MatchRow[] };

const sourceOf = (mode: Source['mode'], rounds: RoundRow[]): Source => ({
  mode,
  rounds: rounds.map(({ id, type }) => ({ id, type, name: id, data: null })),
  matches: rounds.flatMap(({ id: roundId, matches }) =>
    matches.map(([id, home, away, winner = null]) => ({
      id,
      roundId,
      home,
      away,
      winner,
      status: winner ? ('completed' as const) : ('pending' as const),
      data: null,
    })),
  ),
});

const SE = SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET;

const EIGHT_TEAMS = sourceOf(TOURNAMENT_MODE.SINGLE_ELIMINATION, [
  {
    id: 'quarters',
    type: SE,
    matches: [
      ['q1', 'team-a', 'team-b', 'home'],
      ['q2', 'team-c', 'team-d', 'home'],
      ['q3', 'team-e', 'team-f', 'home'],
      ['q4', 'team-g', 'team-h', 'home'],
    ],
  },
  {
    id: 'semis',
    type: SE,
    matches: [
      ['s1', 'team-a', 'team-c', 'home'],
      ['s2', 'team-e', 'team-g', 'away'],
    ],
  },
  { id: 'final', type: COMMON_BRACKET_ROUND_TYPE.FINAL, matches: [['f1', 'team-a', 'team-g']] },
]);

const UB = DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET;
const LB = DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET;

const DOUBLE = sourceOf(TOURNAMENT_MODE.DOUBLE_ELIMINATION, [
  {
    id: 'ub-1',
    type: UB,
    matches: [
      ['ub-1-1', 'team-a', 'team-b', 'home'],
      ['ub-1-2', 'team-c', 'team-d', 'home'],
    ],
  },
  { id: 'ub-2', type: UB, matches: [['ub-2-1', 'team-a', 'team-c', 'home']] },
  { id: 'lb-1', type: LB, matches: [['lb-1-1', 'team-b', 'team-d', 'home']] },
  { id: 'lb-2', type: LB, matches: [['lb-2-1', 'team-c', 'team-b', 'home']] },
  { id: 'grand-final', type: COMMON_BRACKET_ROUND_TYPE.FINAL, matches: [['gf-1', 'team-a', 'team-c']] },
  {
    id: 'reset',
    type: DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL,
    matches: [['reset-1', 'team-c', 'team-a']],
  },
]);

const SWISS = sourceOf(TOURNAMENT_MODE.SWISS_WITH_ELIMINATION, [
  {
    id: 'swiss-1',
    type: SWISS_BRACKET_ROUND_TYPE.SWISS,
    matches: [
      ['w1-1', 'team-a', 'team-b', 'home'],
      ['w1-2', 'team-c', 'team-d', 'home'],
    ],
  },
  {
    id: 'swiss-2',
    type: SWISS_BRACKET_ROUND_TYPE.SWISS,
    matches: [
      ['w2-1', 'team-a', 'team-c', 'home'],
      ['w2-2', 'team-b', 'team-d', 'home'],
    ],
  },
  { id: 'swiss-3', type: SWISS_BRACKET_ROUND_TYPE.SWISS, matches: [['w3-1', 'team-c', 'team-b']] },
]);

const normalize = (match: {
  id: string;
  home: { id: string } | null;
  away: { id: string } | null;
}): NormalizedMatch => {
  const side = (participant: { id: string } | null) =>
    participant
      ? { id: participant.id, name: participant.id, code: participant.id, subtitle: null, emblem: null, seed: null }
      : null;

  return {
    id: match.id,
    status: 'scheduled',
    startTime: null,
    home: side(match.home),
    away: side(match.away),
    homeScore: null,
    awayScore: null,
    resultKind: 'score',
    gameScores: null,
    winnerSide: null,
    label: null,
  };
};

const ALL_LAYOUTS = [singleEliminationBracketLayout(), doubleEliminationBracketLayout(), swissBracketLayout()];

@Component({
  selector: 'et-scenario-bracket-canvas',
  imports: [BracketComponent],
  providers: [provideBracketConfig({ matchNormalizer: normalize, ...BRACKET_DEFAULT_CARDS })],
  template: `<et-bracket [source]="source()" [layouts]="layouts()" [swissColors]="swissColors()" />`,
})
class BracketCanvasComponent {
  source = signal<Source>(EIGHT_TEAMS);
  layouts = signal<readonly BracketLayout[]>(ALL_LAYOUTS);
  swissColors = signal<Partial<Record<string, string>> | undefined>(undefined);
}

type SwissMatchCardInputs =
  BracketMatchComponent<null, null> extends new (...args: never[]) => infer TInputs ? TInputs : never;
type InputValue<TInput> = TInput extends () => infer TValue ? TValue : never;

@Component({
  selector: 'et-scenario-swiss-group-card',
  template: `<span class="scenario-swiss-card">{{ bracketMatch().id }} {{ bracketRoundSwissGroup()?.name }}</span>`,
})
class SwissGroupMatchCardComponent implements SwissMatchCardInputs {
  bracketRound = input.required<InputValue<SwissMatchCardInputs['bracketRound']>>();
  bracketMatch = input.required<InputValue<SwissMatchCardInputs['bracketMatch']>>();
  bracketRoundSwissGroup = input.required<InputValue<SwissMatchCardInputs['bracketRoundSwissGroup']>>();
}

@Component({
  selector: 'et-scenario-bracket-swiss-cards',
  imports: [BracketComponent],
  providers: [provideBracketConfig({ matchNormalizer: normalize, ...BRACKET_DEFAULT_CARDS })],
  template: `<et-bracket [source]="source" [layouts]="layouts" [matchComponent]="card" />`,
})
class BracketSwissCardsComponent {
  source = SWISS;
  layouts = ALL_LAYOUTS;
  card = SwissGroupMatchCardComponent;
}

@Component({
  selector: 'et-scenario-bracket-list',
  imports: [BRACKET_ROUNDS_LIST_IMPORTS],
  providers: [
    provideBracketConfig({ layouts: ALL_LAYOUTS, matchNormalizer: normalize, ...BRACKET_DEFAULT_CARDS }),
    provideBracketLabels({ finalsSection: 'Deciders' }),
  ],
  template: `
    <et-bracket-rounds-list
      [source]="source()"
      [selectedRoundId]="selectedRoundId()"
      [hideRoundHeaders]="hideRoundHeaders()"
    />
  `,
})
class BracketListComponent {
  list = viewChild.required(BracketRoundsListComponent);
  source = signal<Source>(DOUBLE);
  selectedRoundId = signal<string | null>(null);
  hideRoundHeaders = signal(false);
}

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const renderedWidth = (host: HTMLElement) =>
  Number.parseFloat(host.querySelector<HTMLElement>('.et-bracket')?.style.width ?? '');

describe('bracket layout scenarios', () => {
  const scenario = useScenario();

  it('predicts the drawn width with bracketNaturalWidth and answers bracketFitsWidth from it', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BracketCanvasComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    s.flush();

    const natural = bracketNaturalWidth(EIGHT_TEAMS, { layouts: ALL_LAYOUTS });

    expect(natural).toBe(
      2 * BRACKET_DEFAULTS.columnWidth + 2 * BRACKET_DEFAULTS.columnGap + BRACKET_DEFAULTS.finalColumnWidth,
    );
    expect(renderedWidth(host)).toBe(natural);
    expect(bracketNaturalWidth(EIGHT_TEAMS, { layouts: ALL_LAYOUTS, columnWidth: 200 })).toBe(natural - 100);
    expect(bracketFitsWidth(EIGHT_TEAMS, { layouts: ALL_LAYOUTS }, natural)).toBe(true);
    expect(bracketFitsWidth(EIGHT_TEAMS, { layouts: ALL_LAYOUTS }, natural - 1)).toBe(false);
    expect(() => bracketNaturalWidth(EIGHT_TEAMS)).toThrow(`ET${BRACKET_ERROR_CODES.LAYOUT_NOT_REGISTERED}`);
  });

  it('folds a single elimination bracket in half with the mirrored layout', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BracketCanvasComponent);
    const host = fixture.nativeElement as HTMLElement;
    const canvas = fixture.componentInstance;
    const plainWidth = bracketNaturalWidth(EIGHT_TEAMS, { layouts: [singleEliminationBracketLayout()] });
    const mirrored = [mirroredSingleEliminationBracketLayout()];

    canvas.layouts.set(mirrored);
    s.tick();
    s.flush();

    expect(renderedWidth(host)).toBe(bracketNaturalWidth(EIGHT_TEAMS, { layouts: mirrored }));
    expect(renderedWidth(host)).toBeGreaterThan(plainWidth);
    expect(host.querySelectorAll('.et-bracket-round')).toHaveLength(5);

    const bracket = createBracket(EIGHT_TEAMS, { layout: BRACKET_DATA_LAYOUT.MIRRORED });
    const halves = Array.from(bracket.rounds.values()).map((round) => [round.id, round.mirrorRoundType]);

    expect(halves).toEqual([
      ['quarters--half-1', BRACKET_ROUND_MIRROR_TYPE.LEFT],
      ['semis--half-1', BRACKET_ROUND_MIRROR_TYPE.LEFT],
      ['final', null],
      ['semis--half-2', BRACKET_ROUND_MIRROR_TYPE.RIGHT],
      ['quarters--half-2', BRACKET_ROUND_MIRROR_TYPE.RIGHT],
    ]);
  });

  it('draws double elimination with either layout and picks the first registered one for the mode', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BracketCanvasComponent);
    const host = fixture.nativeElement as HTMLElement;
    const canvas = fixture.componentInstance;
    const plain = doubleEliminationBracketLayout();
    const mirrored = mirroredDoubleEliminationBracketLayout();

    expect(resolveBracketLayout([plain, mirrored], TOURNAMENT_MODE.DOUBLE_ELIMINATION)).toBe(plain);
    expect(resolveBracketLayout([mirrored, plain], TOURNAMENT_MODE.DOUBLE_ELIMINATION)).toBe(mirrored);
    expect(() => resolveBracketLayout([plain], TOURNAMENT_MODE.SINGLE_ELIMINATION)).toThrow(
      `ET${BRACKET_ERROR_CODES.LAYOUT_NOT_REGISTERED}`,
    );

    canvas.source.set(DOUBLE);
    canvas.layouts.set([plain, mirrored]);
    s.tick();
    s.flush();

    const cells = () =>
      Array.from(host.querySelectorAll<HTMLElement>('.et-bracket-element--match')).map(
        (cell) => cell.dataset['matchId'],
      );

    expect(host.querySelector('.et-bracket--double-elimination')).not.toBeNull();
    expect(cells().sort()).toEqual(['gf-1', 'lb-1-1', 'lb-2-1', 'reset-1', 'ub-1-1', 'ub-1-2', 'ub-2-1']);
    expect(renderedWidth(host)).toBe(bracketNaturalWidth(DOUBLE, { layouts: [plain] }));

    canvas.layouts.set([mirrored]);
    s.tick();

    expect(cells().sort()).toEqual(['gf-1', 'lb-1-1', 'lb-2-1', 'reset-1', 'ub-1-1', 'ub-1-2', 'ub-2-1']);
    expect(renderedWidth(host)).toBe(bracketNaturalWidth(DOUBLE, { layouts: [mirrored] }));
    expect(s.errors).toEqual([]);
  });

  it('draws a swiss stage as standings groups coloured by BRACKET_SWISS_GROUP_COLOR_TYPE', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BracketCanvasComponent);
    const host = fixture.nativeElement as HTMLElement;
    const canvas = fixture.componentInstance;

    canvas.source.set(SWISS);
    canvas.swissColors.set({
      [BRACKET_SWISS_GROUP_COLOR_TYPE.NEUTRAL]: 'rgb(1, 1, 1)',
      [BRACKET_SWISS_GROUP_COLOR_TYPE.POSITIVE]: 'rgb(2, 2, 2)',
      [BRACKET_SWISS_GROUP_COLOR_TYPE.NEGATIVE]: 'rgb(3, 3, 3)',
      [BRACKET_SWISS_GROUP_COLOR_TYPE.WARNING]: 'rgb(4, 4, 4)',
    });
    s.tick();
    s.flush();

    expect(host.querySelector('.et-bracket--swiss-with-elimination')).not.toBeNull();

    const groupNames = Array.from(host.querySelectorAll('.et-bracket-default-round-header-group')).map(text);

    expect(groupNames).toEqual(['0-0', '1-0', '0-1', '1-1']);

    const strokes = Array.from(host.querySelectorAll('.et-bracket-svg rect')).map((rect) =>
      rect.getAttribute('stroke'),
    );

    expect(strokes).toEqual(['rgb(1, 1, 1)', 'rgb(2, 2, 2)', 'rgb(4, 4, 4)', 'rgb(4, 4, 4)']);
  });

  it("hands a custom match component its round's swiss group, typed from BracketMatchComponent", () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BracketSwissCardsComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    s.flush();

    expect(Array.from(host.querySelectorAll('.scenario-swiss-card')).map(text)).toEqual([
      'w1-1 0-0',
      'w1-2 0-0',
      'w2-1 1-0',
      'w2-2 0-1',
      'w3-1 1-1',
    ]);
    expect(s.errors).toEqual([]);
  });

  it('lists double elimination rounds under upper, lower and finals sections', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BracketListComponent);
    expect(fixture.componentInstance.list()).toBeInstanceOf(BracketRoundsListComponent);
    const host = fixture.nativeElement as HTMLElement;
    const list = fixture.componentInstance;

    s.tick();
    s.flush();

    const sections = () =>
      Array.from(host.querySelectorAll<HTMLElement>('.et-bracket-rounds-list-section')).map((section) => ({
        id: section.dataset['section'],
        name: text(section.querySelector('.et-bracket-rounds-list-section-name')),
        rounds: Array.from(section.querySelectorAll('.et-bracket-default-round-header-name')).map(text),
      }));

    expect(sections()).toEqual([
      { id: 'upper', name: 'Upper bracket', rounds: ['ub-1', 'ub-2'] },
      { id: 'lower', name: 'Lower bracket', rounds: ['lb-1', 'lb-2'] },
      { id: 'finals', name: 'Deciders', rounds: ['grand-final', 'reset'] },
    ]);
    expect(host.querySelector('.et-bracket-rounds-list-section-name')?.getAttribute('aria-level')).toBe('2');
    expect(host.querySelectorAll('et-bracket-default-final-match')).toHaveLength(1);
    expect(host.querySelector('.et-bracket-svg')).toBeNull();

    list.selectedRoundId.set('lb-2');
    s.tick();

    expect(sections()).toEqual([{ id: 'lower', name: 'Lower bracket', rounds: ['lb-2'] }]);
    expect(host.querySelectorAll('.et-bracket-rounds-list-match')).toHaveLength(1);

    list.hideRoundHeaders.set(true);
    s.tick();

    expect(host.querySelector('et-bracket-default-round-header')).toBeNull();
    expect(host.querySelectorAll('.et-bracket-rounds-list-match')).toHaveLength(1);
  });

  it('lists a swiss round as one block per standings group, and a single elimination as one section', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BracketListComponent);
    const host = fixture.nativeElement as HTMLElement;
    const list = fixture.componentInstance;

    list.source.set(SWISS);
    list.selectedRoundId.set('swiss-2');
    s.tick();
    s.flush();

    expect(Array.from(host.querySelectorAll('.et-bracket-default-round-header-group')).map(text)).toEqual([
      '1-0',
      '0-1',
    ]);
    expect(host.querySelectorAll('.et-bracket-rounds-list-block')).toHaveLength(2);

    list.source.set(EIGHT_TEAMS);
    list.selectedRoundId.set(null);
    s.tick();

    expect(host.querySelectorAll('.et-bracket-rounds-list-section')).toHaveLength(1);
    expect(host.querySelector('.et-bracket-rounds-list-section-name')).toBeNull();
    expect(host.querySelectorAll('.et-bracket-rounds-list-match')).toHaveLength(7);
  });

  it('links a source into a bracket of BracketMaps', () => {
    const bracket = createBracket(EIGHT_TEAMS, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

    expect(bracket.rounds).toBeInstanceOf(BracketMap);
    expect(bracket.rounds.first()?.id).toBe('quarters');
    expect(bracket.rounds.last()?.type).toBe(COMMON_BRACKET_ROUND_TYPE.FINAL);
    expect(bracket.rounds.getOrThrow('semis' as never).matchCount).toBe(2);
    expect(() => bracket.rounds.getOrThrow('missing' as never)).toThrow(`ET${BRACKET_ERROR_CODES.DATA_LOOKUP_FAILED}`);

    const teamA = bracket.participants.getOrThrow('team-a' as never);

    expect(teamA.matches.size).toBe(3);

    const final = bracket.matches.getOrThrow('f1' as never);

    expect([final.home?.id, final.away?.id]).toEqual(['team-a', 'team-g']);

    const grouped = createBracket(
      sourceOf(TOURNAMENT_MODE.SINGLE_ELIMINATION, [
        { id: 'group', type: GROUP_BRACKET_ROUND_TYPE.GROUP, matches: [['g1', 'team-a', 'team-b']] },
      ]),
      { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT },
    );

    expect(grouped.rounds.first()?.type).toBe('group');
  });
});

describe('bracket Ethlete integration scenarios', () => {
  type Round = EthleteRoundWithMatchesInput['round'];
  type Match = EthleteRoundWithMatchesInput['matches'][number];

  const ethleteMatch = (id: string, matchType: Match['matchType']): Match => ({
    id,
    home: { id: `${id}-home` },
    away: { id: `${id}-away` },
    winningSide: null,
    status: 'preparing',
    matchType,
  });

  const round = (id: string, type: Round['type'], matches: Match[]) => ({ round: { id, name: null, type }, matches });

  it('maps Ethlete round kinds onto bracket round types per tournament mode', () => {
    const map = (type: Round['type'], mode: Source['mode'], isLastRound: boolean) =>
      generateRoundTypeFromEthleteRoundType(type, mode, isLastRound);

    expect(map('normal', TOURNAMENT_MODE.SINGLE_ELIMINATION, false)).toBe(SE);
    expect(map('normal', TOURNAMENT_MODE.SINGLE_ELIMINATION, true)).toBe(COMMON_BRACKET_ROUND_TYPE.FINAL);
    expect(map('normal', TOURNAMENT_MODE.SWISS_WITH_ELIMINATION, true)).toBe(SWISS_BRACKET_ROUND_TYPE.SWISS);
    expect(map('third_place', TOURNAMENT_MODE.SINGLE_ELIMINATION, true)).toBe(COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE);
    expect(map('winner_bracket', TOURNAMENT_MODE.DOUBLE_ELIMINATION, false)).toBe(UB);
    expect(map('loser_bracket', TOURNAMENT_MODE.DOUBLE_ELIMINATION, false)).toBe(LB);
    expect(map('reverse_final', TOURNAMENT_MODE.DOUBLE_ELIMINATION, true)).toBe(
      DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL,
    );
    expect(() => map('normal', TOURNAMENT_MODE.DOUBLE_ELIMINATION, false)).toThrow(
      `ET${BRACKET_ERROR_CODES.MODE_UNSUPPORTED}`,
    );
  });

  it('detects the tournament mode from the first drawn match', () => {
    expect(
      generateTournamentModeFromEthleteRounds([
        round('empty', 'winner_bracket', []),
        round('ub', 'winner_bracket', [ethleteMatch('m1', 'double_elimination')]),
      ]),
    ).toBe(TOURNAMENT_MODE.DOUBLE_ELIMINATION);
    expect(
      generateTournamentModeFromEthleteRounds([round('r', 'normal', [ethleteMatch('m1', 'single_elimination')])]),
    ).toBe(TOURNAMENT_MODE.SINGLE_ELIMINATION);
    expect(
      generateTournamentModeFromEthleteRounds([
        round('s1', 'normal', [ethleteMatch('m1', 'fifa_swiss'), ethleteMatch('m2', 'fifa_swiss')]),
        round('ko', 'final', [ethleteMatch('m3', 'fifa_swiss')]),
      ]),
    ).toBe(TOURNAMENT_MODE.SWISS_WITH_ELIMINATION);

    expect(() => generateTournamentModeFromEthleteRounds([])).toThrow(`ET${BRACKET_ERROR_CODES.SOURCE_EMPTY}`);
    expect(generateTournamentModeFromEthleteRounds([round('r', 'normal', [])])).toBe(
      TOURNAMENT_MODE.SINGLE_ELIMINATION,
    );
    expect(() =>
      generateTournamentModeFromEthleteRounds([round('r', 'normal', [ethleteMatch('m1', 'league')])]),
    ).toThrow(`ET${BRACKET_ERROR_CODES.MODE_UNSUPPORTED}`);
  });

  it('builds a source from an Ethlete stage and rejects duplicate ids', () => {
    const decided: Match = { ...ethleteMatch('m1', 'single_elimination'), status: 'published', winningSide: 'away' };
    const source = generateBracketDataForEthlete([
      round('r1', 'normal', [decided, ethleteMatch('m2', 'single_elimination')]),
    ]);

    expect(source.mode).toBe(TOURNAMENT_MODE.SINGLE_ELIMINATION);
    expect(source.rounds).toEqual([
      {
        id: 'r1',
        type: COMMON_BRACKET_ROUND_TYPE.FINAL,
        name: 'normal',
        data: { id: 'r1', name: null, type: 'normal' },
      },
    ]);
    expect(source.matches.map(({ id, home, away, winner, status }) => ({ id, home, away, winner, status }))).toEqual([
      { id: 'm1', home: 'm1-home', away: 'm1-away', winner: 'away', status: 'completed' },
      { id: 'm2', home: 'm2-home', away: 'm2-away', winner: null, status: 'pending' },
    ]);

    expect(() =>
      generateBracketDataForEthlete([
        round('r1', 'normal', [ethleteMatch('m1', 'single_elimination'), ethleteMatch('m1', 'single_elimination')]),
      ]),
    ).toThrow(`ET${BRACKET_ERROR_CODES.DUPLICATE_MATCH}`);
    expect(() =>
      generateBracketDataForEthlete([
        round('r1', 'normal', [ethleteMatch('m1', 'single_elimination'), ethleteMatch('m2', 'single_elimination')]),
        round('r1', 'final', [ethleteMatch('m3', 'single_elimination')]),
      ]),
    ).toThrow(`ET${BRACKET_ERROR_CODES.DUPLICATE_ROUND}`);
  });
});
