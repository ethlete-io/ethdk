import { BracketDataSource } from '../integrations';
import { createBracket } from '../linked';
import { BracketMatchId } from './match';
import { BRACKET_DATA_LAYOUT } from './layout';
import { COMMON_BRACKET_ROUND_TYPE, DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE, SWISS_BRACKET_ROUND_TYPE } from './round';
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

/** `a` wins the upper bracket, `b` comes through the lower bracket, and `b` wins the grand final. */
const doubleEliminationFinal = (withReverseFinal: boolean): BracketDataSource<null, null> => ({
  mode: TOURNAMENT_MODE.DOUBLE_ELIMINATION,
  rounds: [
    { id: 'ub', type: DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET, name: 'Upper', data: null },
    { id: 'lb', type: DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET, name: 'Lower', data: null },
    { id: 'final', type: COMMON_BRACKET_ROUND_TYPE.FINAL, name: 'Final', data: null },
    ...(withReverseFinal
      ? [{ id: 'reverse', type: DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL, name: 'Reset', data: null }]
      : []),
  ],
  matches: [
    { id: 'ub0', roundId: 'ub', home: 'a', away: 'b', winner: 'home', status: 'completed', data: null },
    { id: 'lb0', roundId: 'lb', home: 'b', away: 'c', winner: 'home', status: 'completed', data: null },
    { id: 'gf', roundId: 'final', home: 'a', away: 'b', winner: 'away', status: 'completed', data: null },
  ],
});

const grandFinalState = (withReverseFinal: boolean) => {
  const final = createBracket(doubleEliminationFinal(withReverseFinal), {
    layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT,
  }).matches.getOrThrow('gf' as BracketMatchId);

  return [final.home, final.away].map((participant) => ({
    isEliminationMatch: participant?.isEliminationMatch,
    isEliminated: participant?.isEliminated,
  }));
};

describe('createNewMatchParticipantBase in a double elimination', () => {
  it('puts the loser of a grand final with no reverse final out', () => {
    expect(grandFinalState(false)).toEqual([
      { isEliminationMatch: true, isEliminated: true },
      { isEliminationMatch: true, isEliminated: false },
    ]);
  });

  it('keeps the upper-bracket finalist in when a reverse final follows', () => {
    expect(grandFinalState(true)).toEqual([
      { isEliminationMatch: false, isEliminated: false },
      { isEliminationMatch: true, isEliminated: false },
    ]);
  });

  it('finds the lower-bracket finalist whatever order the source lists its rounds in', () => {
    const source = doubleEliminationFinal(true);
    const lowerFirst = [...source.rounds].sort(
      (a, b) =>
        Number(b.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET) -
        Number(a.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET),
    );

    const final = createBracket(
      { ...source, rounds: lowerFirst },
      { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT },
    ).matches.getOrThrow('gf' as BracketMatchId);

    expect([final.home?.isEliminationMatch, final.away?.isEliminationMatch]).toEqual([false, true]);
  });
});

const singleEliminationWithThirdPlace = (withThirdPlace: boolean): BracketDataSource<null, null> => ({
  mode: TOURNAMENT_MODE.SINGLE_ELIMINATION,
  rounds: [
    { id: 'sf', type: 'single-elimination-bracket', name: 'Semi final', data: null },
    { id: 'f', type: COMMON_BRACKET_ROUND_TYPE.FINAL, name: 'Final', data: null },
    ...(withThirdPlace
      ? [{ id: 't', type: COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE, name: 'Third place', data: null }]
      : []),
  ],
  matches: [
    { id: 's1', roundId: 'sf', home: 'a', away: 'c', winner: 'home', status: 'completed', data: null },
    { id: 's2', roundId: 'sf', home: 'b', away: 'd', winner: 'home', status: 'completed', data: null },
    { id: 'f1', roundId: 'f', home: 'a', away: 'b', winner: 'home', status: 'completed', data: null },
    ...(withThirdPlace
      ? [
          {
            id: 't1',
            roundId: 't',
            home: 'c',
            away: 'd',
            winner: 'home' as const,
            status: 'completed' as const,
            data: null,
          },
        ]
      : []),
  ],
});

describe('createNewMatchParticipantBase in a single elimination', () => {
  const state = (withThirdPlace: boolean, matchId: string) => {
    const match = createBracket(singleEliminationWithThirdPlace(withThirdPlace), {
      layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT,
    }).matches.getOrThrow(matchId as BracketMatchId);

    return [match.home, match.away].map((participant) => ({
      isEliminationMatch: participant?.isEliminationMatch,
      isEliminated: participant?.isEliminated,
    }));
  };

  it('keeps a semi final loser in when a third place match follows', () => {
    expect(state(true, 's1')).toEqual([
      { isEliminationMatch: false, isEliminated: false },
      { isEliminationMatch: false, isEliminated: false },
    ]);
  });

  it('puts the loser of the third place match out', () => {
    expect(state(true, 't1')).toEqual([
      { isEliminationMatch: true, isEliminated: false },
      { isEliminationMatch: true, isEliminated: true },
    ]);
  });

  it('puts a semi final loser out when no third place match follows', () => {
    expect(state(false, 's1')).toEqual([
      { isEliminationMatch: true, isEliminated: false },
      { isEliminationMatch: true, isEliminated: true },
    ]);
  });
});
