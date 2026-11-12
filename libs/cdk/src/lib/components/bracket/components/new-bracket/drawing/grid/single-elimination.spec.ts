import { BRACKET_DATA_LAYOUT, BracketDataLayout, TOURNAMENT_MODE } from '../../core';
import { BracketDataSource, BracketMatchSource } from '../../integrations';
import { createNewBracket } from '../../linked';
import { BracketComponents } from './core';
import { createSingleEliminationGrid } from './single-elimination';
import { CreateBracketGridConfig } from './types';

const COLUMN_WIDTH = 200;
const COLUMN_GAP = 50;

const CONFIG: CreateBracketGridConfig = {
  includeRoundHeaders: false,
  columnWidth: COLUMN_WIDTH,
  matchHeight: 80,
  roundHeaderHeight: 0,
  roundHeaderGap: 0,
  columnGap: COLUMN_GAP,
  rowRoundGap: 0,
  rowGap: 10,
  finalMatchHeight: 80,
  finalColumnWidth: COLUMN_WIDTH,
  swissGroupPadding: 0,
  swissGroupBorderWidth: 0,
  layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT,
};

const COMPONENTS = {
  roundHeader: class {},
  match: class {},
  finalMatch: class {},
  continue: class {},
} as unknown as BracketComponents<null, null>;

const pendingMatch = (id: string, roundId: string): BracketMatchSource<null> => ({
  id,
  roundId,
  home: null,
  away: null,
  winner: null,
  status: 'pending',
  data: null,
});

/** A single elimination with the given match count per round. The last round is the final. */
const singleElimination = (matchCounts: number[]): BracketDataSource<null, null> => ({
  mode: TOURNAMENT_MODE.SINGLE_ELIMINATION,
  rounds: matchCounts.map((_, roundIndex) => ({
    id: `r${roundIndex}`,
    name: `Round ${roundIndex}`,
    type: roundIndex === matchCounts.length - 1 ? 'final' : 'single-elimination-bracket',
    data: null,
  })),
  matches: matchCounts.flatMap((count, roundIndex) =>
    Array.from({ length: count }, (_, matchIndex) => pendingMatch(`r${roundIndex}m${matchIndex}`, `r${roundIndex}`)),
  ),
});

const withThirdPlace = (source: BracketDataSource<null, null>): BracketDataSource<null, null> => ({
  ...source,
  rounds: [...source.rounds, { id: 'third', name: 'Third place', type: 'third-place', data: null }],
  matches: [...source.matches, pendingMatch('thirdm0', 'third')],
});

const createGrid = (
  source: BracketDataSource<null, null>,
  layout: BracketDataLayout,
  config: Partial<CreateBracketGridConfig> = {},
) => createSingleEliminationGrid(createNewBracket(source, { layout }), { ...CONFIG, layout, ...config }, COMPONENTS);

const continueElementCount = (grid: ReturnType<typeof createGrid>) =>
  grid.columns.flatMap((column) => column.elements).filter((element) => element.type === 'continue').length;

describe('createSingleEliminationGrid with a third place match', () => {
  const source = () => withThirdPlace(singleElimination([4, 2, 1]));

  it('keeps the final as the last match of the chain', () => {
    const bracket = createNewBracket(source(), { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

    expect(bracket.matches.getOrThrow('r2m0' as never).relation.type).toBe('two-to-nothing');
  });

  it('gives the third place its own column after the final while the offset is unset', () => {
    const grid = createGrid(source(), BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT);

    expect(grid.matchElementMap.getOrThrow('thirdm0' as never).dimensions.left).toBe(
      grid.matchElementMap.getOrThrow('r2m0' as never).dimensions.left + COLUMN_WIDTH + COLUMN_GAP,
    );
  });

  it('still draws the continue column', () => {
    const grid = createGrid(source(), BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT, {
      continueElement: { columnWidth: 100, elementHeight: 50 },
    });

    expect(continueElementCount(grid)).toBe(1);
  });

  it("places it in the final's column, that many px below the final's card", () => {
    const grid = createGrid(source(), BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT, { thirdPlaceTopOffset: 100 });
    const final = grid.matchElementMap.getOrThrow('r2m0' as never).dimensions;
    const thirdPlace = grid.matchElementMap.getOrThrow('thirdm0' as never).dimensions;

    expect(thirdPlace.left).toBe(final.left);
    expect(thirdPlace.top).toBe(final.top + 100);
  });

  it('places the folded card below its own round header', () => {
    const headers = { includeRoundHeaders: true, roundHeaderHeight: 40, roundHeaderGap: 10 };
    const grid = createGrid(source(), BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT, { ...headers, thirdPlaceTopOffset: 150 });
    const final = grid.matchElementMap.getOrThrow('r2m0' as never).dimensions;
    const thirdPlace = grid.matchElementMap.getOrThrow('thirdm0' as never).dimensions;

    expect(thirdPlace.top).toBe(final.top + 150);
  });

  it('keeps the grid tall enough for a fold that hangs past the final', () => {
    const grid = createGrid(source(), BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT, { thirdPlaceTopOffset: 400 });
    const thirdPlace = grid.matchElementMap.getOrThrow('thirdm0' as never).dimensions;

    expect(grid.raw.grid.dimensions.height).toBeGreaterThanOrEqual(thirdPlace.top + thirdPlace.height);
  });

  it('keeps the grid height when a continue column follows the fold', () => {
    const folded = createGrid(source(), BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT, { thirdPlaceTopOffset: 100 });
    const continued = createGrid(source(), BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT, {
      thirdPlaceTopOffset: 100,
      continueElement: { columnWidth: 100, elementHeight: 50 },
    });

    expect(continueElementCount(continued)).toBe(1);
    expect(continued.raw.grid.masterColumns.length).toBe(folded.raw.grid.masterColumns.length + 2);
    expect(continued.raw.grid.dimensions.height).toBe(folded.raw.grid.dimensions.height);
  });

  it('folds the third place under the final in a mirrored layout while the offset is unset', () => {
    const grid = createGrid(source(), BRACKET_DATA_LAYOUT.MIRRORED);
    const final = grid.matchElementMap.getOrThrow('r2m0' as never).dimensions;
    const thirdPlace = grid.matchElementMap.getOrThrow('thirdm0' as never).dimensions;
    const rightSemiFinal = grid.matchElementMap.getOrThrow('r1m1' as never).dimensions;

    expect(thirdPlace.left).toBe(final.left);
    expect(thirdPlace.top).toBe(final.top + final.height + CONFIG.rowGap);
    expect(rightSemiFinal.left).toBe(final.left + COLUMN_WIDTH + COLUMN_GAP);
    expect(grid.raw.grid.dimensions.height).toBeGreaterThanOrEqual(thirdPlace.top + thirdPlace.height);
  });

  it('leaves the third place in its own column when the source has no final to fold it into', () => {
    const noFinal: BracketDataSource<null, null> = {
      ...withThirdPlace(singleElimination([4, 2])),
      rounds: [
        { id: 'r0', name: 'Round 0', type: 'single-elimination-bracket', data: null },
        { id: 'r1', name: 'Round 1', type: 'single-elimination-bracket', data: null },
        { id: 'third', name: 'Third place', type: 'third-place', data: null },
      ],
    };
    const grid = createGrid(noFinal, BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT, { thirdPlaceTopOffset: 100 });

    expect(grid.matchElementMap.getOrThrow('thirdm0' as never).dimensions.left).toBeGreaterThan(
      grid.matchElementMap.getOrThrow('r1m0' as never).dimensions.left,
    );
  });
});

describe('isEliminated in a single elimination', () => {
  const played = (thirdPlace: boolean): BracketDataSource<null, null> => {
    const completed = (id: string, roundId: string, home: string, away: string): BracketMatchSource<null> => ({
      id,
      roundId,
      home,
      away,
      winner: 'home',
      status: 'completed',
      data: null,
    });

    return {
      mode: TOURNAMENT_MODE.SINGLE_ELIMINATION,
      rounds: [
        { id: 'semi', name: 'Semi final', type: 'single-elimination-bracket', data: null },
        { id: 'final', name: 'Final', type: 'final', data: null },
        ...(thirdPlace ? [{ id: 'third', name: 'Third place', type: 'third-place' as const, data: null }] : []),
      ],
      matches: [
        completed('s0', 'semi', 'a', 'b'),
        completed('s1', 'semi', 'c', 'd'),
        completed('f0', 'final', 'a', 'c'),
        ...(thirdPlace ? [completed('t0', 'third', 'b', 'd')] : []),
      ],
    };
  };

  const eliminated = (source: BracketDataSource<null, null>, matchId: string) => {
    const match = createNewBracket(source, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT }).matches.getOrThrow(
      matchId as never,
    );

    return { home: match.home?.isEliminated, away: match.away?.isEliminated };
  };

  it('does not eliminate a semi final loser who still plays for third place', () => {
    expect(eliminated(played(true), 's0')).toEqual({ home: false, away: false });
    expect(eliminated(played(true), 't0')).toEqual({ home: false, away: true });
    expect(eliminated(played(true), 'f0')).toEqual({ home: false, away: true });
  });

  it('eliminates a semi final loser when no third place match follows', () => {
    expect(eliminated(played(false), 's0')).toEqual({ home: false, away: true });
  });
});
