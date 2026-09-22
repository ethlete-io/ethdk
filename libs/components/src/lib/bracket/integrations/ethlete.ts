import {
  BracketRoundType,
  COMMON_BRACKET_ROUND_TYPE,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
  SINGLE_ELIMINATION_BRACKET_ROUND_TYPE,
  SWISS_BRACKET_ROUND_TYPE,
  TOURNAMENT_MODE,
  TournamentMode,
} from '../core';
import { BracketDataSource, BracketMatchSource, BracketRoundSource } from './base';
import { RuntimeError } from '@ethlete/core';
import { EthleteMatchInput, EthleteMatchStatusInput, NormalizedMatch, normalizeEthleteMatch } from '../../match';
import { BRACKET_ERROR_CODES } from '../bracket-errors';
import { BracketMatch } from '../linked';

/** The round kinds of the Ethlete API. */
export type EthleteRoundTypeInput =
  'normal' | 'third_place' | 'final' | 'reverse_final' | 'winner_bracket' | 'loser_bracket';

/** The stage kinds of the Ethlete API, carried on each match as `matchType`. */
export type EthleteStageTypeInput =
  'single_elimination' | 'double_elimination' | 'league' | 'pools' | 'groups' | 'fifa_swiss';

/** The round fields {@link generateBracketDataForEthlete} reads. */
export type EthleteRoundInput = {
  id: string;
  name: string | null;
  type: EthleteRoundTypeInput;
};

/** The match fields {@link generateBracketDataForEthlete} reads. */
export type EthleteBracketMatchInput = {
  id: string;
  home: { id: string } | null;
  away: { id: string } | null;
  winningSide: 'home' | 'away' | null;
  status: EthleteMatchStatusInput | null;
  matchType: EthleteStageTypeInput | null;
};

/** One round with its matches, as the Ethlete API returns a stage. Your own round and match types flow through to the bracket's `data`. */
export type EthleteRoundWithMatchesInput<
  TRound extends EthleteRoundInput = EthleteRoundInput,
  TMatch extends EthleteBracketMatchInput = EthleteBracketMatchInput,
> = {
  round: TRound;
  matches: readonly TMatch[];
};

export const generateRoundTypeFromEthleteRoundType = (
  type: EthleteRoundTypeInput,
  tournamentMode: TournamentMode,
  roundMatchCount: number,
  // eslint-disable-next-line max-params -- round-type derivation keyed on three independent facts (type, mode, matchCount)
): BracketRoundType => {
  switch (type) {
    case 'normal':
      switch (tournamentMode) {
        case 'single-elimination':
          // This might break if the single elimination contains a 3rd place match + round
          if (roundMatchCount === 1) {
            return COMMON_BRACKET_ROUND_TYPE.FINAL;
          } else {
            return SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET;
          }
        case 'swiss-with-elimination':
          return SWISS_BRACKET_ROUND_TYPE.SWISS;
        default:
          throw new RuntimeError(
            BRACKET_ERROR_CODES.MODE_UNSUPPORTED,
            `Unsupported tournament mode for a normal type round: ${tournamentMode}`,
          );
      }
    case 'third_place':
      return COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE;
    case 'final':
      return COMMON_BRACKET_ROUND_TYPE.FINAL;
    case 'reverse_final':
      return DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL;
    case 'winner_bracket':
      return DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET;
    case 'loser_bracket':
      return DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET;
  }
};

export const generateTournamentModeFormEthleteRounds = (
  source: readonly EthleteRoundWithMatchesInput[],
): TournamentMode => {
  const firstDrawnRound = source.find((round) => round.matches.length > 0);
  const firstMatch = firstDrawnRound?.matches[0];

  if (!source.length) throw new RuntimeError(BRACKET_ERROR_CODES.SOURCE_EMPTY, 'No rounds found');
  if (!firstDrawnRound || !firstMatch) throw new RuntimeError(BRACKET_ERROR_CODES.SOURCE_EMPTY, 'No matches found');

  switch (firstMatch.matchType) {
    case 'fifa_swiss': {
      const lastRound = source[source.length - 1];

      if (!lastRound) throw new RuntimeError(BRACKET_ERROR_CODES.SOURCE_EMPTY, 'No last round found');

      if (lastRound.matches.length !== firstDrawnRound.matches.length) {
        return TOURNAMENT_MODE.SWISS_WITH_ELIMINATION;
      } else {
        throw new RuntimeError(
          BRACKET_ERROR_CODES.MODE_UNSUPPORTED,
          'Unsupported tournament mode: swiss without elimination',
        );
      }
    }
    case 'double_elimination':
      return TOURNAMENT_MODE.DOUBLE_ELIMINATION;
    case 'single_elimination':
      return TOURNAMENT_MODE.SINGLE_ELIMINATION;
    default:
      throw new RuntimeError(
        BRACKET_ERROR_CODES.MODE_UNSUPPORTED,
        `Unsupported tournament mode: ${firstMatch.matchType}`,
      );
  }
};

export const generateBracketDataForEthlete = <
  TRound extends EthleteRoundInput,
  TMatch extends EthleteBracketMatchInput,
>(
  source: readonly EthleteRoundWithMatchesInput<TRound, TMatch>[],
): BracketDataSource<TRound, TMatch> => {
  const tournamentMode = generateTournamentModeFormEthleteRounds(source);

  const bracketData: BracketDataSource<TRound, TMatch> = {
    rounds: [],
    matches: [],
    mode: tournamentMode,
  };

  for (const currentItem of source) {
    if (bracketData.rounds.some((r) => r.id === currentItem.round.id)) {
      throw new RuntimeError(
        BRACKET_ERROR_CODES.DUPLICATE_ROUND,
        `Round with id ${currentItem.round.id} already exists in the bracket data.`,
      );
    }

    const roundType = generateRoundTypeFromEthleteRoundType(
      currentItem.round.type,
      tournamentMode,
      currentItem.matches.length,
    );

    const bracketRound: BracketRoundSource<TRound> = {
      type: roundType,
      id: currentItem.round.id,
      data: currentItem.round,
      name: currentItem.round.name || currentItem.round.type,
    };

    bracketData.rounds.push(bracketRound);

    for (const match of currentItem.matches) {
      if (bracketData.matches.some((m) => m.id === match.id)) {
        throw new RuntimeError(
          BRACKET_ERROR_CODES.DUPLICATE_MATCH,
          `Match with id ${match.id} already exists in the bracket data.`,
        );
      }

      const bracketMatch: BracketMatchSource<TMatch> = {
        id: match.id,
        data: match,
        roundId: currentItem.round.id,
        home: match.home?.id || null,
        away: match.away?.id || null,
        winner: match.winningSide,
        status: match.status === 'published' ? 'completed' : 'pending',
      };

      bracketData.matches.push(bracketMatch);
    }
  }

  return bracketData;
};

/**
 * The normalizer the bracket's default cards need, for a source built by
 * {@link generateBracketDataForEthlete} - the two halves of the same integration, kept apart because the
 * layout engine has no business knowing what a `MatchListView` is.
 *
 * @example
 * provideBracketConfig({ matchNormalizer: normalizeEthleteBracketMatch });
 */
export const normalizeEthleteBracketMatch = <TRound, TMatch extends EthleteMatchInput>(
  match: BracketMatch<TRound, TMatch>,
): NormalizedMatch => normalizeEthleteMatch(match.data);
