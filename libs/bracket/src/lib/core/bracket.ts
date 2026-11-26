import { BracketDataSource, BracketMatchSource } from '../integrations';
import { BracketMap } from './bracket-map';
import { BracketDataLayout } from './layout';
import { BracketMatchId, BracketMatchWithRelationsBase, createMatchesMapBase } from './match';
import { BracketParticipantWithRelationsBase, createParticipantsMapBase, MatchParticipantId } from './participant';
import {
  BracketRoundId,
  BracketRoundWithRelationsBase,
  createRoundsMapBase,
  TERMINAL_ROUND_SORT_PRIORITY,
} from './round';
import { TournamentMode } from './tournament';
import { BracketRuntimeError } from '../bracket-runtime-error';
import { BRACKET_ERROR_CODES } from '../bracket-errors';

export type BracketBase<TRoundData, TMatchData> = {
  rounds: BracketMap<BracketRoundId, BracketRoundWithRelationsBase<TRoundData>>;
  matches: BracketMap<BracketMatchId, BracketMatchWithRelationsBase<TMatchData>>;
  participants: BracketMap<MatchParticipantId, BracketParticipantWithRelationsBase>;
  mode: TournamentMode;
};

export type GenerateBracketDataOptions = {
  layout: BracketDataLayout;
};

/**
 * Something in a source `createBracket` accepted but probably did not mean: a feeder id that names no
 * match, or a match the declared graph links to nothing because it carries no provenance.
 */
export type BracketWarning =
  | { type: 'unknown-feeder'; matchId: string; feederId: string; message: string }
  | { type: 'unlinked-match'; matchId: string; message: string };

export type CreateBracketOptions<TMatchData> = GenerateBracketDataOptions & {
  /** The matches feeding this one, upper arm first. Slot provenance is used when omitted. */
  previousMatchIds?: (match: BracketMatchSource<TMatchData>) => string[];
  /** Called once per {@link BracketWarning} while the bracket is linked from a declared graph. */
  onWarning?: (warning: BracketWarning) => void;
};

const sortSourceMatchesByRoundOrder = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
): BracketDataSource<TRoundData, TMatchData> => {
  const orderedRoundIds = [...source.rounds]
    .sort((a, b) => (TERMINAL_ROUND_SORT_PRIORITY[a.type] ?? 0) - (TERMINAL_ROUND_SORT_PRIORITY[b.type] ?? 0))
    .map((r) => r.id);

  const roundIndexMap = new Map(orderedRoundIds.map((id, i) => [id, i]));

  const sortedMatches = [...source.matches].sort(
    (a, b) => (roundIndexMap.get(a.roundId) ?? 0) - (roundIndexMap.get(b.roundId) ?? 0),
  );

  return { ...source, matches: sortedMatches };
};

const assertUniqueIds = (options: { ids: string[]; code: number; kind: string }) => {
  const seen = new Set<string>();

  for (const id of options.ids) {
    if (seen.has(id)) {
      throw new BracketRuntimeError(options.code, `${options.kind} with id ${id} exists more than once in the source.`);
    }

    seen.add(id);
  }
};

export const createBracketBase = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
  options: GenerateBracketDataOptions,
) => {
  assertUniqueIds({
    ids: source.rounds.map((round) => round.id),
    code: BRACKET_ERROR_CODES.DUPLICATE_ROUND,
    kind: 'Round',
  });
  assertUniqueIds({
    ids: source.matches.map((match) => match.id),
    code: BRACKET_ERROR_CODES.DUPLICATE_MATCH,
    kind: 'Match',
  });

  const normalizedSource = sortSourceMatchesByRoundOrder(source);

  const participants = createParticipantsMapBase(normalizedSource);
  const rounds = createRoundsMapBase(normalizedSource, options);
  const matches = createMatchesMapBase(normalizedSource, rounds, participants);

  const bracketData: BracketBase<TRoundData, TMatchData> = {
    matches,
    rounds,
    participants,
    mode: source.mode,
  };

  return bracketData;
};
