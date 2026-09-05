import { BRACKET_DATA_LAYOUT, MatchParticipantSide, SWISS_BRACKET_ROUND_TYPE, TOURNAMENT_MODE } from '../core';
import { BracketDataSource } from '../integrations';
import { createBracket } from './bracket';
import { generateBracketRoundSwissGroupMaps } from './swiss';

type SwissMatchInput = [id: string, home: string, away: string, winner: MatchParticipantSide | null];

const swissSource = (rounds: SwissMatchInput[][]): BracketDataSource<null, null> => ({
  mode: TOURNAMENT_MODE.SWISS_WITH_ELIMINATION,
  rounds: rounds.map((_, index) => ({
    id: `r${index}`,
    type: SWISS_BRACKET_ROUND_TYPE.SWISS,
    name: `Round ${index + 1}`,
    data: null,
  })),
  matches: rounds.flatMap((matches, index) =>
    matches.map(([id, home, away, winner]) => ({
      id,
      roundId: `r${index}`,
      home,
      away,
      winner,
      status: winner ? ('completed' as const) : ('pending' as const),
      data: null,
    })),
  ),
});

const groupMaps = (source: BracketDataSource<null, null>) => {
  const groups = generateBracketRoundSwissGroupMaps(
    createBracket(source, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT }),
  );

  if (!groups) throw new Error('not a swiss source');

  return Array.from(groups.values()).map((round) =>
    Object.fromEntries(Array.from(round.groups.values()).map((group) => [group.id, Array.from(group.matches.keys())])),
  );
};

describe('generateBracketRoundSwissGroupMaps', () => {
  it('groups a round a participant sat out by the record they actually carry', () => {
    // e and f play round 1 and round 3 but sit out round 2, so they reach round 3 with one game
    // played while everyone else has two.
    const groups = groupMaps(
      swissSource([
        [
          ['r0-m0', 'a', 'b', 'home'],
          ['r0-m1', 'c', 'd', 'home'],
          ['r0-m2', 'e', 'f', 'home'],
        ],
        [
          ['r1-m0', 'a', 'c', 'home'],
          ['r1-m1', 'b', 'd', 'home'],
        ],
        [
          ['r2-m0', 'e', 'f', null],
          ['r2-m1', 'c', 'b', null],
        ],
      ]),
    );

    expect(groups[2]).toEqual({ '1-0': ['r2-m0'], '1-1': ['r2-m1'] });
  });

  it('keeps the group order of a round every participant played', () => {
    const groups = groupMaps(
      swissSource([
        [
          ['r0-m0', 'a', 'b', 'home'],
          ['r0-m1', 'c', 'd', 'home'],
        ],
        [
          ['r1-m0', 'a', 'c', 'home'],
          ['r1-m1', 'b', 'd', 'home'],
        ],
        [['r2-m0', 'c', 'b', null]],
      ]),
    );

    expect(groups).toEqual([
      { '0-0': ['r0-m0', 'r0-m1'] },
      { '1-0': ['r1-m0'], '0-1': ['r1-m1'] },
      { '1-1': ['r2-m0'] },
    ]);
  });
});
