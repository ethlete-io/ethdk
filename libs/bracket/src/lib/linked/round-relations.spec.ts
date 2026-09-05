import { BRACKET_DATA_LAYOUT, BracketRoundId, SINGLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../core';
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

const describeRelation = (relation: BracketRoundRelation<null, null>) => {
  const parts: string[] = [relation.type];

  if ('previousRound' in relation) parts.push(`prev=${relation.previousRound.id}`);
  if ('nextRound' in relation) parts.push(`next=${relation.nextRound.id}`);

  return parts.join(' ');
};

const relationOf = (source: BracketDataSource<null, null>, roundId: string) =>
  describeRelation(
    createBracket(source, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT }).rounds.getOrThrow(roundId as BracketRoundId)
      .relation,
  );

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
});
