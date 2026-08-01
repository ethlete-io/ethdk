import {
  MatchListViewUnion,
  RoundStageStructureView,
  RoundStageStructureWithMatchesView,
  RoundType,
} from '@ethlete/types';
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
import { normalizeEthleteMatch } from '../../match';
import { BracketMatchNormalizer } from '../bracket-card-context';
import { BRACKET_ERROR_CODES } from '../bracket-errors';

export const generateRoundTypeFromEthleteRoundType = (
  type: RoundType,
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
  source: RoundStageStructureWithMatchesView[],
): TournamentMode => {
  const firstRound = source[0];
  const firstMatch = firstRound?.matches[0];

  if (!firstRound) throw new RuntimeError(BRACKET_ERROR_CODES.SOURCE_EMPTY, 'No rounds found');
  if (!firstMatch) throw new RuntimeError(BRACKET_ERROR_CODES.SOURCE_EMPTY, 'No matches found');

  switch (firstMatch.matchType) {
    case 'fifa_swiss': {
      const lastRound = source[source.length - 1];

      if (!lastRound) throw new RuntimeError(BRACKET_ERROR_CODES.SOURCE_EMPTY, 'No last round found');

      if (lastRound.matches.length !== firstRound.matches.length) {
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

export const generateBracketDataForEthlete = (source: RoundStageStructureWithMatchesView[]) => {
  const tournamentMode = generateTournamentModeFormEthleteRounds(source);

  const bracketData: BracketDataSource<RoundStageStructureView, MatchListViewUnion> = {
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

    const bracketRound: BracketRoundSource<RoundStageStructureView> = {
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

      const bracketMatch: BracketMatchSource<MatchListViewUnion> = {
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
export const normalizeEthleteBracketMatch: BracketMatchNormalizer<RoundStageStructureView, MatchListViewUnion> = (
  match,
) => normalizeEthleteMatch(match.data);
