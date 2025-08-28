import { DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE, TOURNAMENT_MODE } from '../core';
import { NewBracket, NewBracketRound } from './bracket';

export const FIRST_ROUNDS_TYPE = {
  SINGLE: 'single',
  DOUBLE: 'double',
} as const;

export type FirstRoundsType = (typeof FIRST_ROUNDS_TYPE)[keyof typeof FIRST_ROUNDS_TYPE];

export type FirstSingleRounds<TRoundData, TMatchData> = {
  type: typeof FIRST_ROUNDS_TYPE.SINGLE;
  first: NewBracketRound<TRoundData, TMatchData>;
};

export type FirstDoubleRounds<TRoundData, TMatchData> = {
  type: typeof FIRST_ROUNDS_TYPE.DOUBLE;
  upper: NewBracketRound<TRoundData, TMatchData>;
  lower: NewBracketRound<TRoundData, TMatchData>;
};

export type FirstRounds<TRoundData, TMatchData> =
  | FirstSingleRounds<TRoundData, TMatchData>
  | FirstDoubleRounds<TRoundData, TMatchData>;

export const getFirstRounds = <TRoundData, TMatchData>(
  bracketData: NewBracket<TRoundData, TMatchData>,
): FirstRounds<TRoundData, TMatchData> => {
  if (bracketData.mode === TOURNAMENT_MODE.DOUBLE_ELIMINATION) {
    const upper = bracketData.roundsByType.getOrThrow(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET).first();
    const lower = bracketData.roundsByType.getOrThrow(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET).first();

    if (!upper || !lower) {
      throw new Error('Upper or lower first round is null');
    }

    return {
      type: FIRST_ROUNDS_TYPE.DOUBLE,
      upper,
      lower,
    };
  }

  const first = bracketData.rounds.first();

  if (!first) throw new Error('First round is null');

  return {
    type: FIRST_ROUNDS_TYPE.SINGLE,
    first,
  };
};
