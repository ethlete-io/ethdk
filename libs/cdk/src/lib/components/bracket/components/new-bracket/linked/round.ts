import { BracketRoundId, BracketRoundType, DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE, TOURNAMENT_MODE } from '../core';
import { NewBracket, NewBracketRound } from './bracket';

export type BracketRoundTypeMap<TRoundData, TMatchData> = Map<
  BracketRoundType,
  BracketRoundMap<TRoundData, TMatchData>
>;

export type BracketRoundMap<TRoundData, TMatchData> = Map<BracketRoundId, NewBracketRound<TRoundData, TMatchData>>;

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
  roundTypeMap: BracketRoundTypeMap<TRoundData, TMatchData>,
): FirstRounds<TRoundData, TMatchData> => {
  if (bracketData.mode === TOURNAMENT_MODE.DOUBLE_ELIMINATION) {
    const upper = roundTypeMap.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET)?.values().next().value;
    const lower = roundTypeMap.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET)?.values().next().value;

    if (!upper || !lower) throw new Error('Upper or lower bracket is null');

    return {
      type: FIRST_ROUNDS_TYPE.DOUBLE,
      upper,
      lower,
    };
  }

  const first = bracketData.rounds.values().next().value;

  if (!first) throw new Error('First round is null');

  return {
    type: FIRST_ROUNDS_TYPE.SINGLE,
    first,
  };
};

export const generateBracketRoundTypeMap = <TRoundData, TMatchData>(
  bracketData: NewBracket<TRoundData, TMatchData>,
) => {
  const roundAmountMap: BracketRoundTypeMap<TRoundData, TMatchData> = new Map();

  for (const round of bracketData.rounds.values()) {
    if (!roundAmountMap.has(round.type)) {
      roundAmountMap.set(round.type, new Map([[round.id, round]]));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      roundAmountMap.set(round.type, roundAmountMap.get(round.type)!.set(round.id, round));
    }
  }

  return roundAmountMap;
};
