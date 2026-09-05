import { BracketDataSource } from '../integrations';
import { createBracket } from '../linked';
import { BracketMatchId } from './match';
import { BRACKET_DATA_LAYOUT } from './layout';
import { SWISS_BRACKET_ROUND_TYPE } from './round';
import { TOURNAMENT_MODE } from './tournament';

/** `a` loses every round, so each match is one further along their way out. */
const LOSING_STREAK: BracketDataSource<null, null> = {
  mode: TOURNAMENT_MODE.SWISS_WITH_ELIMINATION,
  rounds: [0, 1, 2].map((index) => ({
    id: `r${index}`,
    type: SWISS_BRACKET_ROUND_TYPE.SWISS,
    name: `Round ${index + 1}`,
    data: null,
  })),
  matches: [0, 1, 2].map((index) => ({
    id: `m${index}`,
    roundId: `r${index}`,
    home: 'a',
    away: 'b',
    winner: 'away' as const,
    status: 'completed' as const,
    data: null,
  })),
};

describe('createNewMatchParticipantBase', () => {
  it('keeps a swiss participant in until their third loss', () => {
    const bracket = createBracket(LOSING_STREAK, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

    const eliminationState = [0, 1, 2].map((index) => {
      const home = bracket.matches.getOrThrow(`m${index}` as BracketMatchId).home;

      return { isEliminationMatch: home?.isEliminationMatch, isEliminated: home?.isEliminated };
    });

    expect(eliminationState).toEqual([
      { isEliminationMatch: false, isEliminated: false },
      { isEliminationMatch: false, isEliminated: false },
      { isEliminationMatch: true, isEliminated: true },
    ]);
  });
});
