import { BracketDataSource } from '../integrations';
import { BRACKET_DATA_LAYOUT } from './layout';
import { createRoundsMapBase } from './round';

const singleElimination = (matchCounts: number[]): BracketDataSource<null, null> => ({
  mode: 'single-elimination',
  rounds: matchCounts.map((_, roundIndex) => ({
    id: `r${roundIndex}`,
    name: `Round ${roundIndex}`,
    type: roundIndex === matchCounts.length - 1 ? ('final' as const) : ('single-elimination-bracket' as const),
    data: null,
  })),
  matches: matchCounts.flatMap((count, roundIndex) =>
    Array.from({ length: count }, (_, matchIndex) => ({
      id: `r${roundIndex}m${matchIndex}`,
      roundId: `r${roundIndex}`,
      home: null,
      away: null,
      winner: null,
      status: 'pending' as const,
      data: null,
    })),
  ),
});

const fold = (matchCounts: number[]) =>
  [...createRoundsMapBase(singleElimination(matchCounts), { layout: BRACKET_DATA_LAYOUT.MIRRORED }).values()].map(
    (round) => `${round.id} ${round.mirrorRoundType ?? 'middle'} depth=${round.logicalIndex}`,
  );

describe('createRoundsMapBase', () => {
  it('folds a power-of-two field around the rounds it cannot halve', () => {
    expect(fold([4, 2, 1])).toEqual([
      'r0--half-1 left depth=0',
      'r1--half-1 left depth=1',
      'r2 middle depth=2',
      'r1--half-2 right depth=1',
      'r0--half-2 right depth=0',
    ]);
  });

  it('stops folding at the first round it cannot halve', () => {
    expect(fold([6, 3, 2, 1])).toEqual([
      'r0--half-1 left depth=0',
      'r1 middle depth=1',
      'r2 middle depth=2',
      'r3 middle depth=3',
      'r0--half-2 right depth=0',
    ]);
  });

  it('leaves a field it can never halve unfolded', () => {
    expect(fold([3, 2, 1])).toEqual(['r0 middle depth=0', 'r1 middle depth=1', 'r2 middle depth=2']);
  });

  it('treats a round with no matches yet as the end of the fold', () => {
    expect(fold([4, 2, 0])).toEqual([
      'r0--half-1 left depth=0',
      'r1--half-1 left depth=1',
      'r2 middle depth=2',
      'r1--half-2 right depth=1',
      'r0--half-2 right depth=0',
    ]);
  });
});
