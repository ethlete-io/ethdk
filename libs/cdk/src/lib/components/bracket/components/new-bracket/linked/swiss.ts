import { BracketMap, BracketMatchId, BracketRoundId, TOURNAMENT_MODE } from '../core';
import { NewBracket, NewBracketMatch } from './bracket';

export type BracketRoundSwissGroupId = string & { __brand: 'BracketRoundSwissGroupId' };

export type BracketRoundSwissGroup<TRoundData, TMatchData> = {
  id: BracketRoundSwissGroupId;
  name: string;
  matches: BracketMap<BracketMatchId, NewBracketMatch<TRoundData, TMatchData>>;
  allowedMatchCount: number;
};

export type BracketRoundSwissGroupMap<TRoundData, TMatchData> = Map<
  BracketRoundSwissGroupId,
  BracketRoundSwissGroup<TRoundData, TMatchData>
>;

export type BracketRoundSwissData<TRoundData, TMatchData> = {
  groups: BracketRoundSwissGroupMap<TRoundData, TMatchData>;
};

export type BracketRoundMapWithSwissData<TRoundData, TMatchData> = Map<
  BracketRoundId,
  BracketRoundSwissData<TRoundData, TMatchData>
>;

export const SWISS_ADVANCE_WINS = 3;
export const SWISS_ELIMINATE_LOSSES = 3;

export const BRACKET_SWISS_GROUP_COLOR_TYPE = {
  /** The starting group (0-0) */
  NEUTRAL: 'neutral',

  /** The group has more wins than losses */
  POSITIVE: 'positive',

  /** The group is one loss away from elimination */
  NEGATIVE: 'negative',

  /** Everything in between */
  WARNING: 'warning',
} as const;

export type BracketSwissGroupColorType =
  (typeof BRACKET_SWISS_GROUP_COLOR_TYPE)[keyof typeof BRACKET_SWISS_GROUP_COLOR_TYPE];

export const getSwissGroupColorType = (wins: number, losses: number): BracketSwissGroupColorType => {
  if (wins === 0 && losses === 0) return BRACKET_SWISS_GROUP_COLOR_TYPE.NEUTRAL;
  if (losses === SWISS_ELIMINATE_LOSSES - 1) return BRACKET_SWISS_GROUP_COLOR_TYPE.NEGATIVE;
  if (wins > losses) return BRACKET_SWISS_GROUP_COLOR_TYPE.POSITIVE;

  return BRACKET_SWISS_GROUP_COLOR_TYPE.WARNING;
};

const factorialCache = new Map<number, number>();

export const getAvailableSwissGroupsForRound = (roundNumber: number, totalMatchesInRound: number) => {
  const ADVANCE_WINS = SWISS_ADVANCE_WINS;
  const ELIMINATE_LOSSES = SWISS_ELIMINATE_LOSSES;

  // Cache factorial calculations
  const getFactorial = (n: number): number => {
    if (n <= 1) return 1;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (factorialCache.has(n)) return factorialCache.get(n)!;

    const result = n * getFactorial(n - 1);
    factorialCache.set(n, result);
    return result;
  };

  // Pre-calculate roundFactorial
  const roundFactorial = getFactorial(roundNumber);

  let totalCombinations = 0;
  const validGroups: { wins: number; losses: number; combinations: number }[] = [];

  // Single loop to gather valid groups and total combinations
  for (let wins = roundNumber; wins >= 0; wins--) {
    const losses = roundNumber - wins;
    const remainingGames = ADVANCE_WINS + ELIMINATE_LOSSES - (wins + losses) - 1;
    const notYetEliminated = losses < ELIMINATE_LOSSES;
    const canStillAdvance = wins < ADVANCE_WINS && remainingGames >= 0;

    if (!canStillAdvance || !notYetEliminated) continue;

    const combinations = roundFactorial / (getFactorial(wins) * getFactorial(losses));
    totalCombinations += combinations;
    validGroups.push({ wins, losses, combinations });
  }

  // Create final groups with calculated proportions
  return validGroups.map(({ wins, losses, combinations }) => ({
    id: `${wins}-${losses}` as BracketRoundSwissGroupId,
    name: `${wins}-${losses}`,
    matchesInGroup: Math.round((combinations / totalCombinations) * totalMatchesInRound),
  }));
};

export const generateBracketRoundSwissGroupMaps = <TRoundData, TMatchData>(
  bracketData: NewBracket<TRoundData, TMatchData>,
) => {
  if (bracketData.mode !== TOURNAMENT_MODE.SWISS_WITH_ELIMINATION) {
    return null;
  }

  const roundsWithSwissGroups: BracketRoundMapWithSwissData<TRoundData, TMatchData> = new Map();

  let roundNumber = 0;
  for (const bracketRound of bracketData.rounds.values()) {
    const availableGroups = getAvailableSwissGroupsForRound(roundNumber, bracketRound.matchCount);

    const roundSwissData: BracketRoundSwissData<TRoundData, TMatchData> = {
      groups: new Map(),
    };

    for (const group of availableGroups) {
      const subGroup: BracketRoundSwissGroup<TRoundData, TMatchData> = {
        id: group.id,
        name: group.name,
        matches: new BracketMap(),
        allowedMatchCount: group.matchesInGroup,
      };

      roundSwissData.groups.set(group.id, subGroup);
    }

    const emptyMatchIds: BracketMatchId[] = [];

    for (const match of bracketRound.matches.values()) {
      const anyParticipant = match.home || match.away;

      if (!anyParticipant) {
        emptyMatchIds.push(match.id);
        continue;
      }

      const wins = anyParticipant.winCount;
      const losses = anyParticipant.lossCount;

      const group = roundSwissData.groups.get(`${wins}-${losses}` as BracketRoundSwissGroupId);

      if (!group) throw new Error('Group not found for match: ' + match.id);

      group.matches.set(match.id, match);
    }

    for (const emptyMatchId of emptyMatchIds) {
      const match = bracketRound.matches.getOrThrow(emptyMatchId);

      let groupFound = false;
      for (const group of roundSwissData.groups.values()) {
        if (group.matches.size < group.allowedMatchCount) {
          group.matches.set(match.id, match);
          groupFound = true;
          break;
        }
      }

      if (!groupFound) {
        throw new Error('No group found for empty match');
      }
    }

    roundsWithSwissGroups.set(bracketRound.id, roundSwissData);

    roundNumber++;
  }

  return roundsWithSwissGroups;
};
