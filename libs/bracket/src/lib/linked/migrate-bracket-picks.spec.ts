import { BRACKET_DATA_LAYOUT, SINGLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../core';
import { BracketDataSource, BracketMatchSource, BracketSlotSource } from '../integrations';
import { createBracket } from './bracket';
import { BracketPickMigrationOptions, migrateBracketPicks } from './migrate-bracket-picks';

const slot = (overrides: Partial<BracketSlotSource>): BracketSlotSource => ({
  kind: 'seed',
  role: null,
  matchId: null,
  standingId: null,
  rank: null,
  label: null,
  ...overrides,
});

const seed = () => slot({ kind: 'seed' });
const bye = () => slot({ kind: 'bye', label: 'Bye' });
const winnerOf = (matchId: string) => slot({ kind: 'match-outcome', role: 'winner', matchId });
const loserOf = (matchId: string) => slot({ kind: 'match-outcome', role: 'loser', matchId });
const standingRank = (standingId: string, rank: number) => slot({ kind: 'standing-rank', standingId, rank });

const match = (options: {
  id: string;
  roundId: string;
  home?: string | null;
  away?: string | null;
  homeSource?: BracketSlotSource;
  awaySource?: BracketSlotSource;
}): BracketMatchSource<null> => ({
  id: options.id,
  roundId: options.roundId,
  home: options.home ?? null,
  away: options.away ?? null,
  homeSource: options.homeSource ?? seed(),
  awaySource: options.awaySource ?? seed(),
  winner: null,
  status: 'pending',
  data: null,
});

const sourceOf = (roundIds: string[], matches: BracketMatchSource<null>[]): BracketDataSource<null, null> => ({
  mode: 'single-elimination',
  rounds: roundIds.map((id) => ({
    id,
    name: id,
    type: SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET,
    data: null,
  })),
  matches,
});

const migrate = (
  source: BracketDataSource<null, null>,
  picks: Record<string, string>,
  options: Partial<BracketPickMigrationOptions> = {},
) =>
  migrateBracketPicks({
    bracket: createBracket(source, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT }),
    pickAsMade: (matchId) => picks[matchId] ?? null,
    ...options,
  });

/** Two seeded matches, their winners meeting in a final. */
const twoIntoOne = () =>
  sourceOf(
    ['r1', 'r2'],
    [
      match({ id: 'm1', roundId: 'r1', home: 'a', away: 'b' }),
      match({ id: 'm2', roundId: 'r1', home: 'c', away: 'd' }),
      match({ id: 'm3', roundId: 'r2', homeSource: winnerOf('m1'), awaySource: winnerOf('m2') }),
    ],
  );

describe('migrateBracketPicks', () => {
  it('keeps a pick that still names one of the two resolved sides of its own match', () => {
    const migration = migrate(twoIntoOne(), { m1: 'a', m2: 'd' });

    expect(migration.pickByMatchId).toEqual({ m1: 'a', m2: 'd' });
    expect(migration.movedFromByMatchId).toEqual({});
    expect(migration.strandedByMatchId).toEqual({});
  });

  it('moves a pick to the one match of its round that its participant now plays', () => {
    const migration = migrate(twoIntoOne(), { m1: 'c' });

    expect(migration.pickByMatchId).toEqual({ m2: 'c' });
    expect(migration.movedFromByMatchId).toEqual({ m2: 'm1' });
    expect(migration.strandedByMatchId).toEqual({});
  });

  it('strands a pick no match of its round can honour, leaving that match without a selection', () => {
    const migration = migrate(twoIntoOne(), { m1: 'z' });

    expect(migration.pickByMatchId).toEqual({});
    expect(migration.strandedByMatchId).toEqual({ m1: 'z' });
  });

  it('keeps a locked pick where it was made and reports it stranded rather than moving it out', () => {
    const migration = migrate(twoIntoOne(), { m1: 'c' }, { lockedMatchIds: new Set(['m1']) });

    expect(migration.pickByMatchId).toEqual({ m1: 'c' });
    expect(migration.movedFromByMatchId).toEqual({});
    expect(migration.strandedByMatchId).toEqual({ m1: 'c' });
  });

  it('never moves a pick into a locked match, stranding the traveller instead', () => {
    const migration = migrate(twoIntoOne(), { m1: 'c' }, { lockedMatchIds: new Set(['m2']) });

    expect(migration.pickByMatchId).toEqual({});
    expect(migration.strandedByMatchId).toEqual({ m1: 'c' });
  });

  it('leaves a match that stranded its own pick empty even where another pick reached it', () => {
    const source = sourceOf(
      ['r1'],
      [
        match({ id: 'm1', roundId: 'r1', home: 'a', away: 'b' }),
        match({ id: 'm2', roundId: 'r1', home: 'c', away: 'd' }),
        match({ id: 'm3', roundId: 'r1', home: 'e', away: 'f' }),
      ],
    );
    const migration = migrate(source, { m1: 'c', m2: 'z' });

    expect(migration.pickByMatchId).toEqual({});
    expect(migration.movedFromByMatchId).toEqual({ m2: 'm1' });
    expect(migration.strandedByMatchId).toEqual({ m2: 'z' });
  });

  it('settles a round before the round it feeds, so a later pick sees the moved sides', () => {
    const source = sourceOf(
      ['r1', 'r2', 'r3'],
      [
        match({ id: 'm1', roundId: 'r1', home: 'a', away: 'b' }),
        match({ id: 'm2', roundId: 'r1', home: 'c', away: 'd' }),
        match({ id: 'm3', roundId: 'r1', home: 'e', away: 'f' }),
        match({ id: 'm4', roundId: 'r1', home: 'g', away: 'h' }),
        match({ id: 'm5', roundId: 'r2', homeSource: winnerOf('m1'), awaySource: winnerOf('m2') }),
        match({ id: 'm6', roundId: 'r2', homeSource: winnerOf('m3'), awaySource: winnerOf('m4') }),
        match({ id: 'm7', roundId: 'r3', homeSource: winnerOf('m5'), awaySource: winnerOf('m6') }),
      ],
    );

    const migration = migrate(source, { m1: 'c', m2: 'a', m3: 'e', m4: 'g', m5: 'c', m7: 'c' });

    expect(migration.pickByMatchId).toEqual({ m1: 'a', m2: 'c', m3: 'e', m4: 'g', m5: 'c', m7: 'c' });
    expect(migration.movedFromByMatchId).toEqual({ m1: 'm2', m2: 'm1' });
    expect(migration.strandedByMatchId).toEqual({});
  });

  it('advances the occupied side of a bye when settling the round it feeds', () => {
    const source = sourceOf(
      ['r1', 'r2'],
      [
        match({ id: 'm1', roundId: 'r1', home: 'a', awaySource: bye() }),
        match({ id: 'm2', roundId: 'r1', home: 'c', away: 'd' }),
        match({ id: 'm3', roundId: 'r2', homeSource: winnerOf('m1'), awaySource: winnerOf('m2') }),
      ],
    );

    expect(migrate(source, { m2: 'd', m3: 'a' }).pickByMatchId).toEqual({ m2: 'd', m3: 'a' });
    expect(migrate(source, { m2: 'd', m3: 'c' }).strandedByMatchId).toEqual({ m3: 'c' });
  });

  it('resolves standing-rank sides from the given table order', () => {
    const source = sourceOf(
      ['r1'],
      [
        match({ id: 'm1', roundId: 'r1', homeSource: standingRank('g1', 1), awaySource: standingRank('g1', 2) }),
        match({ id: 'm2', roundId: 'r1', homeSource: standingRank('g1', 3), awaySource: standingRank('g1', 4) }),
      ],
    );
    const order = ['a', 'b', 'c', 'd'];
    const migration = migrate(source, { m1: 'd' }, { standingRank: ({ rank }) => order[rank - 1] ?? null });

    expect(migration.pickByMatchId).toEqual({ m2: 'd' });
    expect(migration.movedFromByMatchId).toEqual({ m2: 'm1' });
  });

  it('settles a cyclic provenance graph instead of looping over it', () => {
    const source = sourceOf(
      ['r1', 'r2'],
      [
        match({ id: 'm1', roundId: 'r1', homeSource: winnerOf('m3'), away: 'b' }),
        match({ id: 'm2', roundId: 'r1', home: 'c', away: 'd' }),
        match({ id: 'm3', roundId: 'r2', homeSource: winnerOf('m1'), awaySource: winnerOf('m2') }),
      ],
    );

    const migration = migrate(source, { m1: 'b', m2: 'c', m3: 'b' });

    expect(migration.pickByMatchId).toEqual({ m1: 'b', m2: 'c' });
    expect(migration.strandedByMatchId).toEqual({ m3: 'b' });
  });

  it('forwards the resolution policy, so a locked round is settled against its predictions', () => {
    const source = sourceOf(
      ['r1', 'r2'],
      [
        match({ id: 'm1', roundId: 'r1', home: 'a', away: 'b' }),
        match({ id: 'm2', roundId: 'r1', home: 'c', away: 'd' }),
        match({
          id: 'm3',
          roundId: 'r2',
          home: 'c',
          away: 'd',
          homeSource: winnerOf('m1'),
          awaySource: winnerOf('m2'),
        }),
      ],
    );
    const picks = { m1: 'a', m2: 'c', m3: 'd' };

    expect(migrate(source, picks).strandedByMatchId).toEqual({ m3: 'd' });
    expect(migrate(source, picks, { realParticipantOutranksPick: () => true }).pickByMatchId).toEqual({
      m1: 'a',
      m2: 'c',
      m3: 'd',
    });
  });

  it('forwards the open-side policy, so a pick survives a round the picks do not fill', () => {
    const source = sourceOf(
      ['r1', 'r2', 'r3'],
      [
        match({ id: 'm1', roundId: 'r1', home: 'a', away: 'b' }),
        match({ id: 'm2', roundId: 'r1', home: 'c', away: 'd' }),
        match({ id: 'm3', roundId: 'r2', homeSource: winnerOf('m1'), awaySource: winnerOf('m2') }),
        match({ id: 'm4', roundId: 'r3', homeSource: winnerOf('m3'), awaySource: loserOf('m3') }),
      ],
    );
    const picks = { m1: 'a', m3: 'a', m4: 'a' };

    expect(migrate(source, picks).strandedByMatchId).toEqual({ m4: 'a' });
    expect(migrate(source, picks, { keepPickWhileFeederSideIsOpen: true }).pickByMatchId).toEqual({
      m1: 'a',
      m3: 'a',
      m4: 'a',
    });
  });
});
