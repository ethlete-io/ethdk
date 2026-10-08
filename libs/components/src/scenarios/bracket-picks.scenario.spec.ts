import { Component, computed, input, signal, viewChildren } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BRACKET_DATA_LAYOUT,
  BRACKET_PICK_CARD_NOTE_TONE,
  Bracket,
  BracketDataSource,
  BracketMatch,
  BracketMatchSource,
  BRACKET_PICK_CARD_IMPORTS,
  BracketPickCardComponent,
  BracketPickSet,
  BracketSlotSource,
  bracketSlot,
  COMMON_BRACKET_ROUND_TYPE,
  createBracket,
  DEFAULT_BRACKET_LABELS,
  describeBracketSlot,
  injectBracketLabels,
  isBracketSlotPredictable,
  MatchParticipantSide,
  migrateBracketPicks,
  NormalizedMatch,
  NormalizedMatchSideState,
  provideBracketLabels,
  resolveBracketSlot,
  SINGLE_ELIMINATION_BRACKET_ROUND_TYPE,
  TOURNAMENT_MODE,
} from '../index';
import '../test-helpers';
import { useScenario } from './harness';

const seeded = (
  id: string,
  home: string | null,
  away: string | null,
  sources: { home?: BracketSlotSource; away?: BracketSlotSource } = {},
): BracketMatchSource<null> => ({
  id,
  roundId: 'r1',
  home,
  away,
  homeSource: sources.home ?? { kind: 'seed' },
  awaySource: sources.away ?? { kind: 'seed' },
  winner: null,
  status: 'pending',
  data: null,
});

const sourceOf = (opening: BracketMatchSource<null>[]): BracketDataSource<null, null> => ({
  mode: TOURNAMENT_MODE.SINGLE_ELIMINATION,
  rounds: [
    {
      id: 'r1',
      name: 'Semi finals',
      type: SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET,
      data: null,
    },
    { id: 'r2', name: 'Final', type: COMMON_BRACKET_ROUND_TYPE.FINAL, data: null },
  ],
  matches: [
    ...opening,
    {
      id: 'final',
      roundId: 'r2',
      home: null,
      away: null,
      homeSource: bracketSlot.matchOutcome('semi-1', 'winner'),
      awaySource: bracketSlot.matchOutcome('semi-2', 'winner'),
      winner: null,
      status: 'pending',
      data: null,
    },
  ],
});

const WITH_BYE = sourceOf([
  seeded('semi-1', 'team-a', 'team-b'),
  seeded('semi-2', 'team-c', null, { away: bracketSlot.bye() }),
]);

const participant = (id: string) => ({
  id,
  name: `Team ${id.slice(-1).toUpperCase()}`,
  code: null,
  subtitle: null,
  emblem: null,
  seed: null,
});

const normalizeWithPicks = (options: {
  bracket: Bracket<unknown, unknown>;
  picks: BracketPickSet;
  match: BracketMatch<unknown, unknown>;
}) => {
  const { bracket, picks, match } = options;
  const side = (key: MatchParticipantSide) => {
    const real = match[key]?.id ?? null;
    const resolved = resolveBracketSlot({ bracket, picks, matchId: match.id, side: key });
    const source = key === 'home' ? match.homeSource : match.awaySource;
    const state: NormalizedMatchSideState = real
      ? 'occupied'
      : resolved
        ? 'predicted'
        : isBracketSlotPredictable(source)
          ? 'unresolvable'
          : 'unavailable';

    return { participant: resolved ? participant(resolved) : null, state };
  };
  const home = side('home');
  const away = side('away');

  return {
    id: match.id,
    status: 'scheduled',
    startTime: null,
    home: home.participant,
    away: away.participant,
    homeState: home.state,
    awayState: away.state,
    homeScore: null,
    awayScore: null,
    resultKind: 'score',
    gameScores: null,
    winnerSide: null,
    label: null,
  } satisfies NormalizedMatch;
};

@Component({
  selector: 'et-scenario-prediction',
  imports: [BRACKET_PICK_CARD_IMPORTS],
  template: `
    @for (row of rows(); track row.match.id) {
      <et-bracket-pick-card
        [attr.data-card]="row.match.id"
        [bracketMatch]="row.match"
        [normalized]="row.normalized"
        [pickedSide]="row.pickedSide"
        [locked]="locked()"
        [earlierRoundsClosed]="earlierRoundsClosed()"
        [note]="row.match.id === 'final' ? note() : null"
        [noteTone]="noteTone()"
        (pick)="savePick(row.match.id, row.normalized, $event)"
      />
    }
  `,
})
class PredictionComponent {
  cards = viewChildren(BracketPickCardComponent);
  source = input(WITH_BYE);
  picks = signal<Record<string, string>>({});
  locked = signal(false);
  earlierRoundsClosed = signal(false);
  note = signal<string | null>(null);
  noteTone = signal<'muted' | 'invalid'>(BRACKET_PICK_CARD_NOTE_TONE.MUTED);

  bracket = computed(() => createBracket(this.source(), { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT }));

  rows = computed(() => {
    const bracket = this.bracket();
    const picked = this.picks();
    const picks: BracketPickSet = { matchWinner: (matchId) => picked[matchId] ?? null, standingRank: () => null };

    return Array.from(bracket.matches.values()).map((match) => {
      const normalized = normalizeWithPicks({ bracket, picks, match });
      const pick = picked[match.id];
      const pickedSide: MatchParticipantSide | null =
        pick === normalized.home?.id ? 'home' : pick === normalized.away?.id ? 'away' : null;

      return { match, normalized, pickedSide };
    });
  });

  savePick(matchId: string, normalized: NormalizedMatch, side: MatchParticipantSide) {
    const participantId = normalized[side]?.id;

    if (participantId) this.picks.update((picks) => ({ ...picks, [matchId]: participantId }));
  }
}

@Component({
  selector: 'et-scenario-results',
  imports: [BRACKET_PICK_CARD_IMPORTS],
  providers: [provideBracketLabels({ slotBye: 'Freilos' })],
  template: `
    <et-bracket-pick-card [bracketMatch]="match" [normalized]="normalized" readonly pickedSide="home" />
    <et-bracket-pick-card [bracketMatch]="byeMatch" [normalized]="byeNormalized" [disabled]="true" />
  `,
})
class ResultsComponent {
  labels = injectBracketLabels();
  bracket = createBracket(WITH_BYE, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });
  match = this.bracket.matches.getOrThrow('semi-1' as never);
  byeMatch = this.bracket.matches.getOrThrow('semi-2' as never);
  normalized: NormalizedMatch = {
    ...normalizeWithPicks({
      bracket: this.bracket,
      picks: { matchWinner: () => null, standingRank: () => null },
      match: this.match,
    }),
    status: 'finished',
    winnerSide: 'away',
  };
  byeNormalized = normalizeWithPicks({
    bracket: this.bracket,
    picks: { matchWinner: () => null, standingRank: () => null },
    match: this.byeMatch,
  });
}

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const sideText = (side: Element) =>
  [text(side.querySelector('.et-match-participant-name')), text(side.querySelector('.et-bracket-pick-card-predicted'))]
    .filter(Boolean)
    .join(' ');

describe('bracket prediction scenarios', () => {
  const scenario = useScenario();

  it('lets the viewer pick through the bracket, carrying picks into the next round', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PredictionComponent);
    const host = fixture.nativeElement as HTMLElement;
    const page = fixture.componentInstance;
    const card = (id: string) => host.querySelector(`[data-card="${id}"]`);
    const buttons = (id: string) => Array.from(card(id)?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const sideStates = (id: string) =>
      Array.from(card(id)?.querySelectorAll<HTMLElement>('.et-bracket-pick-card-side') ?? []).map(
        (side) => side.dataset['sideState'],
      );

    s.tick();

    expect(page.cards()).toHaveLength(page.rows().length);
    expect(buttons('semi-1').map(sideText)).toEqual(['Team A', 'Team B']);
    expect(buttons('semi-2')).toHaveLength(0);
    expect(text(card('semi-2')?.querySelector('.et-bracket-pick-card-empty'))).toBe(DEFAULT_BRACKET_LABELS.slotBye);
    expect(sideStates('final')).toEqual(['unresolvable', 'predicted']);
    expect(buttons('final')).toHaveLength(0);
    expect(text(card('final')?.querySelector('.et-bracket-pick-card-empty'))).toBe(
      DEFAULT_BRACKET_LABELS.slotPredictEarlierRound,
    );

    page.earlierRoundsClosed.set(true);
    s.tick();

    expect(text(card('final')?.querySelector('.et-bracket-pick-card-empty'))).toBe(
      DEFAULT_BRACKET_LABELS.slotNotPredicted,
    );

    buttons('semi-1')[1]?.click();
    s.tick();

    expect(page.picks()).toEqual({ 'semi-1': 'team-b' });
    expect(buttons('semi-1').map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    expect(buttons('final').map(sideText)).toEqual(['Team B Prediction', 'Team C Prediction']);

    buttons('final')[1]?.click();
    s.tick();

    expect(page.picks()).toEqual({ 'semi-1': 'team-b', final: 'team-c' });

    buttons('semi-1')[0]?.click();
    s.tick();

    expect(buttons('final').map(sideText)).toEqual(['Team A Prediction', 'Team C Prediction']);
    expect(buttons('final')[1]?.getAttribute('aria-pressed')).toBe('true');
  });

  it('locks the picks in place and describes a note on the card', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PredictionComponent);
    const host = fixture.nativeElement as HTMLElement;
    const page = fixture.componentInstance;
    const final = () => host.querySelector('[data-card="final"]');

    page.picks.set({ 'semi-1': 'team-a', final: 'team-a' });
    page.note.set('Your pick moved here');
    s.tick();

    const note = final()?.querySelector('.et-bracket-pick-card-note');

    expect(text(note)).toBe('Your pick moved here');
    expect(final()?.getAttribute('data-note-tone')).toBe(BRACKET_PICK_CARD_NOTE_TONE.MUTED);
    expect(final()?.querySelector('button')?.getAttribute('aria-describedby')).toBe(note?.id);
    expect(final()?.querySelector('.et-bracket-pick-card-invalid-outline')).toBeNull();

    page.noteTone.set(BRACKET_PICK_CARD_NOTE_TONE.INVALID);
    page.locked.set(true);
    s.tick();

    expect(final()?.getAttribute('data-note-tone')).toBe('invalid');
    expect(final()?.querySelector('.et-bracket-pick-card-invalid-outline')).not.toBeNull();
    expect(final()?.hasAttribute('data-locked')).toBe(true);
    expect(host.querySelectorAll('et-bracket-pick-card button')).toHaveLength(0);
    expect(final()?.querySelector('[data-selected]')?.getAttribute('data-participant-id')).toBe('team-a');
  });

  it('shows a decided match read-only, dimming the side it went against, and localizes empty slots', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ResultsComponent);
    const host = fixture.nativeElement as HTMLElement;
    const [results, bye] = Array.from(host.querySelectorAll('et-bracket-pick-card'));

    s.tick();

    expect(results?.hasAttribute('data-readonly')).toBe(true);
    expect(results?.querySelectorAll('button')).toHaveLength(0);
    expect(results?.querySelector('.et-bracket-pick-card-mark')).toBeNull();
    expect(results?.querySelector('[data-dimmed]')?.getAttribute('data-participant-id')).toBe('team-a');
    expect(bye?.hasAttribute('data-disabled')).toBe(true);
    expect(text(bye?.querySelector('.et-bracket-pick-card-empty'))).toBe('Freilos');
  });

  it('describes every kind of empty slot in one line', () => {
    const labels = DEFAULT_BRACKET_LABELS;
    const describe = (source: BracketSlotSource | null) => describeBracketSlot(source, labels);

    expect(describe(null)).toBe(labels.slotUnknown);
    expect(describe(bracketSlot.matchOutcome('m1', 'winner'))).toBe(labels.slotMatchWinner);
    expect(describe(bracketSlot.matchOutcome('m1', 'loser'))).toBe(labels.slotMatchLoser);
    expect(describe(bracketSlot.standingRank('a', 2, 'Group A'))).toBe('Group A position 2');
    expect(describe(bracketSlot.standingRank('a', 2))).toBe('Standing position 2');
    expect(describe(bracketSlot.seed(3))).toBe('Seed 3');
    expect(describe(bracketSlot.swissBucket())).toBe(labels.slotSwissBucket);
    expect(describe(bracketSlot.bye())).toBe(labels.slotBye);
    expect(describe({ kind: 'external' })).toBe(labels.slotExternal);
    expect(describe(bracketSlot.external('Qualifier 1'))).toBe('Qualifier 1');

    expect(isBracketSlotPredictable(bracketSlot.matchOutcome('m1', 'winner'))).toBe(true);
    expect(isBracketSlotPredictable(bracketSlot.standingRank('a', 1))).toBe(true);
    expect(isBracketSlotPredictable(bracketSlot.bye())).toBe(false);
    expect(isBracketSlotPredictable(null)).toBe(false);
  });

  it('resolves standing-rank slots from the viewer standings picks', () => {
    const source: BracketDataSource<null, null> = {
      ...sourceOf([
        seeded('semi-1', null, 'team-b', { home: bracketSlot.standingRank('group-a', 1) }),
        seeded('semi-2', 'team-c', 'team-d'),
      ]),
    };
    const bracket = createBracket(source, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });
    const picks: BracketPickSet = {
      matchWinner: (matchId) => (matchId === 'semi-1' ? 'team-a' : null),
      standingRank: ({ standingId, rank }) => (standingId === 'group-a' && rank === 1 ? 'team-a' : null),
    };

    expect(resolveBracketSlot({ bracket, picks, matchId: 'semi-1', side: 'home' })).toBe('team-a');
    expect(resolveBracketSlot({ bracket, picks, matchId: 'final', side: 'home' })).toBe('team-a');
    expect(resolveBracketSlot({ bracket, picks, matchId: 'final', side: 'away' })).toBeNull();
    expect(
      resolveBracketSlot({ bracket, picks, matchId: 'final', side: 'away', keepPickWhileFeederSideIsOpen: true }),
    ).toBeNull();
    expect(resolveBracketSlot({ bracket, picks, matchId: 'missing', side: 'home' })).toBeNull();
  });

  it('migrates saved picks after a re-draw: kept, moved with their participant, or stranded', () => {
    const redrawn = sourceOf([seeded('semi-1', 'team-a', 'team-d'), seeded('semi-2', 'team-c', 'team-b')]);
    const bracket = createBracket(redrawn, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });
    const saved: Record<string, string> = { 'semi-1': 'team-b', final: 'team-b' };

    const migration = migrateBracketPicks({ bracket, pickAsMade: (matchId) => saved[matchId] ?? null });

    expect(migration.pickByMatchId).toEqual({ 'semi-2': 'team-b', final: 'team-b' });
    expect(migration.movedFromByMatchId).toEqual({ 'semi-2': 'semi-1' });
    expect(migration.strandedByMatchId).toEqual({});

    const locked = migrateBracketPicks({
      bracket,
      pickAsMade: (matchId) => ({ 'semi-1': 'team-z' })[matchId] ?? null,
      lockedMatchIds: new Set(['semi-1']),
    });

    expect(locked.pickByMatchId).toEqual({ 'semi-1': 'team-z' });
    expect(locked.strandedByMatchId).toEqual({ 'semi-1': 'team-z' });
  });
});
