import { BRACKET_ERROR_CODES } from './bracket-errors';
import { BracketRuntimeError } from './bracket-runtime-error';
import {
  BracketRoundType,
  COMMON_BRACKET_ROUND_TYPE,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
  SINGLE_ELIMINATION_BRACKET_ROUND_TYPE,
} from './core/round';
import { TOURNAMENT_MODE } from './core/tournament';
import { BracketDataSource, BracketMatchSource, BracketRoundSource } from './integrations/base';

export type SingleEliminationPlaceholderShape = {
  mode: typeof TOURNAMENT_MODE.SINGLE_ELIMINATION;
  /** A power of two, at least 2. */
  participantCount: number;
  /** @default false */
  includeThirdPlace?: boolean;
};

export type DoubleEliminationPlaceholderShape = {
  mode: typeof TOURNAMENT_MODE.DOUBLE_ELIMINATION;
  /** A power of two, at least 4. */
  participantCount: number;
  /** @default true */
  includeFinal?: boolean;
  /** Ignored when `includeFinal` is false. @default true */
  includeReverseFinal?: boolean;
  /** @default false */
  includeThirdPlace?: boolean;
};

/** The structure a placeholder bracket is drawn with - see {@link createPlaceholderBracketSource}. */
export type PlaceholderBracketShape = SingleEliminationPlaceholderShape | DoubleEliminationPlaceholderShape;

const MIN_PARTICIPANTS: Record<PlaceholderBracketShape['mode'], number> = {
  [TOURNAMENT_MODE.SINGLE_ELIMINATION]: 2,
  [TOURNAMENT_MODE.DOUBLE_ELIMINATION]: 4,
};

const assertParticipantCount = (shape: PlaceholderBracketShape) => {
  const { participantCount, mode } = shape;
  const min = MIN_PARTICIPANTS[mode];
  const isPowerOfTwo = Number.isInteger(participantCount) && (participantCount & (participantCount - 1)) === 0;

  if (participantCount < min || !isPowerOfTwo) {
    throw new BracketRuntimeError(
      BRACKET_ERROR_CODES.PLACEHOLDER_SHAPE_INVALID,
      `A ${mode} placeholder bracket needs a power-of-two participantCount of at least ${min}, got ${participantCount}.`,
    );
  }
};

const halvingCounts = (from: number) => {
  const counts: number[] = [];

  for (let n = from; n >= 1; n = n / 2) {
    counts.push(n);
  }

  return counts;
};

/**
 * An empty bracket of the given shape - every match `pending`, both sides `null` - for drawing a loading
 * state with the real layout before the data arrives. Throws `ET3415` for a `participantCount` that is
 * not a power of two (or too small for the mode).
 *
 * @example
 * const source = createPlaceholderBracketSource({ mode: 'single-elimination', participantCount: 16 });
 */
export const createPlaceholderBracketSource = (shape: PlaceholderBracketShape): BracketDataSource<null, null> => {
  assertParticipantCount(shape);

  const rounds: BracketRoundSource<null>[] = [];
  const matches: BracketMatchSource<null>[] = [];

  const addRound = (round: { id: string; type: BracketRoundType; matchCount: number }) => {
    const { id, type, matchCount } = round;

    rounds.push({ id, type, name: '', data: null });

    for (let index = 0; index < matchCount; index++) {
      matches.push({
        id: `${id}-m${index}`,
        roundId: id,
        home: null,
        away: null,
        winner: null,
        status: 'pending',
        data: null,
      });
    }
  };

  const { participantCount } = shape;

  if (shape.mode === TOURNAMENT_MODE.SINGLE_ELIMINATION) {
    const counts = halvingCounts(participantCount / 2);

    counts.forEach((matchCount, index) => {
      const isFinal = index === counts.length - 1;

      addRound({
        id: isFinal ? 'final' : `r${index}`,
        type: isFinal
          ? COMMON_BRACKET_ROUND_TYPE.FINAL
          : SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET,
        matchCount,
      });
    });

    if (shape.includeThirdPlace) {
      addRound({ id: 'third-place', type: COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE, matchCount: 1 });
    }

    return { mode: TOURNAMENT_MODE.SINGLE_ELIMINATION, rounds, matches };
  }

  const { includeFinal = true, includeReverseFinal = true, includeThirdPlace = false } = shape;

  halvingCounts(participantCount / 2).forEach((matchCount, index) =>
    addRound({ id: `ub-r${index}`, type: DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET, matchCount }),
  );

  halvingCounts(participantCount / 4)
    .flatMap((matchCount) => [matchCount, matchCount])
    .forEach((matchCount, index) =>
      addRound({ id: `lb-r${index}`, type: DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET, matchCount }),
    );

  if (includeFinal) {
    addRound({ id: 'final', type: COMMON_BRACKET_ROUND_TYPE.FINAL, matchCount: 1 });

    if (includeReverseFinal) {
      addRound({ id: 'reverse-final', type: DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL, matchCount: 1 });
    }
  }

  if (includeThirdPlace) {
    addRound({ id: 'third-place', type: COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE, matchCount: 1 });
  }

  return { mode: TOURNAMENT_MODE.DOUBLE_ELIMINATION, rounds, matches };
};
