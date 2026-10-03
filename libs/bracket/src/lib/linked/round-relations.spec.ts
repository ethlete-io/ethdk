import {
  BRACKET_DATA_LAYOUT,
  BracketDataLayout,
  BracketRoundId,
  BracketRoundType,
  COMMON_BRACKET_ROUND_TYPE,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
  SINGLE_ELIMINATION_BRACKET_ROUND_TYPE,
} from '../core';
import { BracketDataSource } from '../integrations';
import { createBracket } from './bracket';
import { BracketRoundRelation } from './round-relations';

const singleElimination = (matchCounts: number[]): BracketDataSource<null, null> => ({
  mode: 'single-elimination',
  rounds: matchCounts.map((_, roundIndex) => ({
    id: `r${roundIndex}`,
    name: `Round ${roundIndex}`,
    type:
      roundIndex === matchCounts.length - 1
        ? ('final' as const)
        : SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET,
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

const doubleElimination = (
  rounds: { id: string; type: BracketRoundType; matchCount: number }[],
): BracketDataSource<null, null> => ({
  mode: 'double-elimination',
  rounds: rounds.map(({ id, type }) => ({ id, name: id, type, data: null })),
  matches: rounds.flatMap(({ id, matchCount }) =>
    Array.from({ length: matchCount }, (_, matchIndex) => ({
      id: `${id}m${matchIndex}`,
      roundId: id,
      home: null,
      away: null,
      winner: null,
      status: 'pending' as const,
      data: null,
    })),
  ),
});

const { UPPER_BRACKET, LOWER_BRACKET, REVERSE_FINAL } = DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE;

const describeRelation = (relation: BracketRoundRelation<null, null>) => {
  const parts: string[] = [relation.type];

  if ('previousRound' in relation) parts.push(`prev=${relation.previousRound.id}`);
  if ('nextRound' in relation) parts.push(`next=${relation.nextRound.id}`);

  return parts.join(' ');
};

const relationOf = (
  source: BracketDataSource<null, null>,
  roundId: string,
  layout: BracketDataLayout = BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT,
) => describeRelation(createBracket(source, { layout }).rounds.getOrThrow(roundId as BracketRoundId).relation);

describe('generateRoundRelations', () => {
  it('links a bracket whose final round has no matches yet', () => {
    const bracket = createBracket(singleElimination([2, 0]), { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

    expect([...bracket.matches.keys()]).toEqual(['r0m0', 'r0m1']);
    expect(bracket.rounds.getOrThrow('r1' as BracketRoundId).matchCount).toBe(0);
  });

  it('links a bracket whose opening round has no matches yet', () => {
    const source = singleElimination([0, 2, 1]);

    expect(relationOf(source, 'r1')).toBe('nothing-to-one next=r2');
    expect(relationOf(source, 'r2')).toBe('one-to-nothing prev=r1');
  });

  it('links across a round whose matches are not drawn yet', () => {
    const source = singleElimination([4, 0, 1]);

    expect(relationOf(source, 'r0')).toBe('nothing-to-one next=r2');
    expect(relationOf(source, 'r2')).toBe('one-to-nothing prev=r0');
  });

  it('links a double elimination whose later lower rounds are not drawn yet', () => {
    const source = doubleElimination([
      { id: 'u1', type: UPPER_BRACKET, matchCount: 2 },
      { id: 'u2', type: UPPER_BRACKET, matchCount: 1 },
      { id: 'l1', type: LOWER_BRACKET, matchCount: 1 },
      { id: 'l2', type: LOWER_BRACKET, matchCount: 0 },
      { id: 'gf', type: 'final', matchCount: 1 },
    ]);

    expect(relationOf(source, 'l1')).toBe('nothing-to-one next=gf');
    expect(relationOf(source, 'gf')).toBe('two-to-nothing');
  });

  it('links a double elimination with a reverse final whose later lower rounds are not drawn yet', () => {
    const source = doubleElimination([
      { id: 'u1', type: UPPER_BRACKET, matchCount: 2 },
      { id: 'u2', type: UPPER_BRACKET, matchCount: 1 },
      { id: 'l1', type: LOWER_BRACKET, matchCount: 1 },
      { id: 'l2', type: LOWER_BRACKET, matchCount: 0 },
      { id: 'gf', type: 'final', matchCount: 1 },
      { id: 'rf', type: REVERSE_FINAL, matchCount: 1 },
    ]);

    expect(relationOf(source, 'l1')).toBe('nothing-to-one next=gf');
    expect(relationOf(source, 'gf')).toBe('two-to-one next=rf');
  });

  it('links both halves of a mirrored bracket to the middle round', () => {
    const source = singleElimination([4, 2, 1]);
    const mirrored = BRACKET_DATA_LAYOUT.MIRRORED;

    expect(relationOf(source, 'r0--half-1', mirrored)).toBe('nothing-to-one next=r1--half-1');
    expect(relationOf(source, 'r1--half-1', mirrored)).toBe('one-to-one prev=r0--half-1 next=r2');
    expect(relationOf(source, 'r2', mirrored)).toBe('one-to-nothing prev=r1--half-1');
    expect(relationOf(source, 'r1--half-2', mirrored)).toBe('one-to-one prev=r0--half-2 next=r2');
    expect(relationOf(source, 'r0--half-2', mirrored)).toBe('nothing-to-one next=r1--half-2');
  });

  it('leaves a third place round out of the chain that ends in the final', () => {
    const source = singleElimination([2, 1]);
    source.rounds.push({ id: 't', name: 'Third place', type: COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE, data: null });
    source.matches.push({
      id: 'tm0',
      roundId: 't',
      home: null,
      away: null,
      winner: null,
      status: 'pending',
      data: null,
    });

    expect(relationOf(source, 'r1')).toBe('one-to-nothing prev=r0');
    expect(relationOf(source, 't')).toBe('none');
  });

  it('leaves a third place round out of a double elimination ending in a reverse final', () => {
    const source = doubleElimination([
      { id: 'u1', type: UPPER_BRACKET, matchCount: 2 },
      { id: 'u2', type: UPPER_BRACKET, matchCount: 1 },
      { id: 'l1', type: LOWER_BRACKET, matchCount: 1 },
      { id: 'l2', type: LOWER_BRACKET, matchCount: 1 },
      { id: 'gf', type: 'final', matchCount: 1 },
      { id: 'rf', type: REVERSE_FINAL, matchCount: 1 },
      { id: 't', type: COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE, matchCount: 1 },
    ]);

    expect(relationOf(source, 'rf')).toBe('one-to-nothing prev=gf');
    expect(relationOf(source, 't')).toBe('none');
  });
});
