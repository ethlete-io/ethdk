import {
  COMMON_BRACKET_ROUND_TYPE,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
  SINGLE_ELIMINATION_BRACKET_ROUND_TYPE,
} from '../core/round';
import { TOURNAMENT_MODE } from '../core/tournament';
import { BracketDataSource, BracketMatchSource, BracketRoundSource } from '../integrations/base';

/**
 * Compact `BracketDataSource` generators for Storybook. Single- and double-elimination
 * layout depends only on each round's `type` and match count (never on `home`/`away`/
 * `winner`), so these emit the minimal structure the engine needs plus recurring
 * participant ids to make journey highlighting meaningful - no giant API fixtures.
 *
 * Swiss is intentionally not generated: its grouping requires cross-round win/loss record
 * consistency that a real tournament fixture expresses more reliably.
 */

type Source = BracketDataSource<null, null>;
type Round = BracketRoundSource<null>;
type Match = BracketMatchSource<null>;

/** Halving match counts for a power-of-two field: `[N/2, N/4, …, 1]`. */
const halvingCounts = (participantCount: number): number[] => {
  const counts: number[] = [];

  for (let n = participantCount / 2; n >= 1; n = n / 2) {
    counts.push(n);
  }

  return counts;
};

/**
 * Participant id for one side of match `matchIndex` in round `roundIndex`, derived by formula
 * so the top seed telescopes forward round to round (home always advances) - a hovered
 * participant's path then lights up, with no array indexing.
 */
const seedId = (
  prefix: string,
  position: { roundIndex: number; matchIndex: number },
): { home: string; away: string } => {
  const { roundIndex, matchIndex } = position;
  const blockSize = 2 ** (roundIndex + 1);
  return {
    home: `${prefix}${matchIndex * blockSize + 1}`,
    away: `${prefix}${matchIndex * blockSize + 2 ** roundIndex + 1}`,
  };
};

/** Single elimination for a power-of-two field. */
export const generateSingleEliminationBracket = (participantCount = 8): Source => {
  const rounds: Round[] = [];
  const matches: Match[] = [];
  const counts = halvingCounts(participantCount);

  counts.forEach((matchCount, roundIndex) => {
    const isFinal = roundIndex === counts.length - 1;
    const roundId = `se-r${roundIndex}`;

    rounds.push({
      id: roundId,
      type: isFinal
        ? COMMON_BRACKET_ROUND_TYPE.FINAL
        : SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET,
      name: isFinal ? 'Final' : `Round ${roundIndex + 1}`,
      data: null,
    });

    for (let m = 0; m < matchCount; m++) {
      const { home, away } = seedId('p', { roundIndex, matchIndex: m });
      matches.push({ id: `${roundId}-m${m}`, roundId, home, away, winner: 'home', status: 'completed', data: null });
    }
  });

  return { mode: TOURNAMENT_MODE.SINGLE_ELIMINATION, rounds, matches };
};

/**
 * Lower-bracket match counts. The complete bracket is `[N/4, N/4, …, 1, 1]`. The `async`
 * form models a truncated view of a bigger tournament: the lower bracket gains one extra
 * leading round (`N/2`), so it runs one round longer than the shown upper bracket implies.
 */
const lowerBracketCounts = (participantCount: number, async: boolean): number[] => {
  const counts: number[] = [];

  for (let n = participantCount / 4; n >= 1; n = n / 2) {
    counts.push(n, n);
  }

  return async ? [participantCount / 2, ...counts] : counts;
};

export type DoubleEliminationOptions = {
  participantCount?: number;
  /**
   * Truncated view of a larger tournament - the lower bracket runs one round longer than the
   * shown winners bracket implies (see `lowerBracketCounts`). Real feeds ship these when the
   * full bracket is too large to render at once.
   */
  partial?: boolean;
  /** Append a grand final. Omit for a bracket that feeds a later stage instead of crowning a winner. */
  includeFinal?: boolean;
  /**
   * Append the bracket-reset (reverse) final after the grand final. Optional - real feeds usually
   * include it, but a grand-final-only bracket is valid. Ignored when `includeFinal` is false.
   */
  includeReverseFinal?: boolean;
  /** Append an optional third-place playoff. */
  includeThirdPlace?: boolean;
  /**
   * Drop the opening winners round so the bracket starts a column late - the grid front-pads
   * the missing column. Models a bracket whose first round is a bye / played elsewhere.
   */
  omitFirstUpperRound?: boolean;
};

/**
 * Double elimination for a power-of-two field. Upper-bracket winners advance cleanly (top seed
 * `u1` wins out); the lower bracket and finals use their own participant ids.
 *
 * `participantCount` of 4 or 8 for the **left-to-right** layout, whose column mapping is a ratio
 * between the two brackets. The stacked (mirrored) layout folds each bracket around its own centre and
 * has no such ratio, so any power-of-two field works there - 32 is the one worth looking at.
 */
export const generateDoubleEliminationBracket = (options: DoubleEliminationOptions = {}): Source => {
  const {
    participantCount = 8,
    partial = false,
    includeFinal = true,
    includeReverseFinal = true,
    includeThirdPlace = false,
    omitFirstUpperRound = false,
  } = options;

  const rounds: Round[] = [];
  const matches: Match[] = [];

  // Upper bracket - clean winner-advances-forward wiring; the top seed reaches the final.
  halvingCounts(participantCount).forEach((matchCount, roundIndex) => {
    if (omitFirstUpperRound && roundIndex === 0) return;

    const roundId = `ub-r${roundIndex}`;

    rounds.push({
      id: roundId,
      type: DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET,
      name: `Winners round ${roundIndex + 1}`,
      data: null,
    });

    for (let m = 0; m < matchCount; m++) {
      const { home, away } = seedId('u', { roundIndex, matchIndex: m });
      matches.push({ id: `${roundId}-m${m}`, roundId, home, away, winner: 'home', status: 'completed', data: null });
    }
  });

  const upperChampion = 'u1';

  // Lower bracket - distinct participant ids per match; the last winner meets the final.
  const lowerCounts = lowerBracketCounts(participantCount, partial);

  lowerCounts.forEach((matchCount, roundIndex) => {
    const roundId = `lb-r${roundIndex}`;

    rounds.push({
      id: roundId,
      type: DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET,
      name: `Losers round ${roundIndex + 1}`,
      data: null,
    });

    for (let m = 0; m < matchCount; m++) {
      matches.push({
        id: `${roundId}-m${m}`,
        roundId,
        home: `l${roundIndex}-${m}h`,
        away: `l${roundIndex}-${m}a`,
        winner: 'home',
        status: 'completed',
        data: null,
      });
    }
  });

  const lowerChampion = `l${lowerCounts.length - 1}-0h`;

  if (includeFinal) {
    rounds.push({ id: 'final', type: COMMON_BRACKET_ROUND_TYPE.FINAL, name: 'Grand final', data: null });
    matches.push({
      id: 'final-m0',
      roundId: 'final',
      home: upperChampion,
      away: lowerChampion,
      winner: null,
      status: 'pending',
      data: null,
    });

    if (includeReverseFinal) {
      rounds.push({
        id: 'reverse-final',
        type: DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL,
        name: 'Bracket reset',
        data: null,
      });
      matches.push({
        id: 'reverse-final-m0',
        roundId: 'reverse-final',
        home: upperChampion,
        away: lowerChampion,
        winner: null,
        status: 'pending',
        data: null,
      });
    }
  }

  if (includeThirdPlace) {
    rounds.push({ id: 'third-place', type: COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE, name: 'Third place', data: null });
    matches.push({
      id: 'third-place-m0',
      roundId: 'third-place',
      home: 'tp-h',
      away: 'tp-a',
      winner: null,
      status: 'pending',
      data: null,
    });
  }

  return { mode: TOURNAMENT_MODE.DOUBLE_ELIMINATION, rounds, matches };
};
