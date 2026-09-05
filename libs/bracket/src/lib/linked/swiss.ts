import {
  BracketMap,
  BracketMatchId,
  BracketMatchParticipantBase,
  BracketRoundId,
  SWISS_ADVANCE_WINS,
  SWISS_ELIMINATE_LOSSES,
  TOURNAMENT_MODE,
} from '../core';
import { Bracket, BracketMatch } from './bracket';

export type BracketRoundSwissGroupId = string & { _brand: 'BracketRoundSwissGroupId' };

export type BracketRoundSwissGroup<TRoundData, TMatchData> = {
  id: BracketRoundSwissGroupId;
  name: string;
  matches: BracketMap<BracketMatchId, BracketMatch<TRoundData, TMatchData>>;
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

/**
 * Colors for the swiss group borders and connection lines, keyed by the group color type
 * (see {@link getSwissGroupColorType}). Connection lines are drawn in the neutral color and fade
 * into the target group color on the last portion before touching its border.
 * Any CSS color value is allowed. Missing entries fall back to the connector/border color
 * (the `--et-bracket-line-color` / `--et-bracket-swiss-group-border-color` custom properties,
 * which default to `--et-surface-border-solid`).
 */
export type BracketSwissColors = Partial<Record<BracketSwissGroupColorType, string>>;

export const getSwissGroupColorType = (wins: number, losses: number): BracketSwissGroupColorType => {
  if (wins === 0 && losses === 0) return BRACKET_SWISS_GROUP_COLOR_TYPE.NEUTRAL;
  if (losses === SWISS_ELIMINATE_LOSSES - 1) return BRACKET_SWISS_GROUP_COLOR_TYPE.NEGATIVE;
  if (wins > losses) return BRACKET_SWISS_GROUP_COLOR_TYPE.POSITIVE;

  return BRACKET_SWISS_GROUP_COLOR_TYPE.WARNING;
};

const factorialCache = /* @__PURE__ */ new Map<number, number>();

export const getAvailableSwissGroupsForRound = (roundNumber: number, totalMatchesInRound: number) => {
  const advanceWins = SWISS_ADVANCE_WINS;
  const eliminateLosses = SWISS_ELIMINATE_LOSSES;

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
    const remainingGames = advanceWins + eliminateLosses - (wins + losses) - 1;
    const notYetEliminated = losses < eliminateLosses;
    const canStillAdvance = wins < advanceWins && remainingGames >= 0;

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

/** The group an undrawn match falls into when its round has no win/loss record to group by. */
const UNDRAWN_SWISS_GROUP_ID = 'undrawn' as BracketRoundSwissGroupId;

const getRecordBeforeMatch = (participant: BracketMatchParticipantBase) => ({
  wins: participant.winCount - (participant.result === 'win' ? 1 : 0),
  losses: participant.lossCount - (participant.result === 'loss' ? 1 : 0),
});

export const generateBracketRoundSwissGroupMaps = <TRoundData, TMatchData>(
  bracketData: Bracket<TRoundData, TMatchData>,
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

      const { wins, losses } = getRecordBeforeMatch(anyParticipant);
      const groupId = `${wins}-${losses}` as BracketRoundSwissGroupId;

      // The table above enumerates the records of somebody who played every round. A bye, a walkover or
      // an uneven field leaves a participant with fewer games than the round index, so their group is
      // real but not in the table - create it rather than losing the whole bracket over one match.
      let group = roundSwissData.groups.get(groupId);

      if (!group) {
        group = { id: groupId, name: `${wins}-${losses}`, matches: new BracketMap(), allowedMatchCount: 0 };
        roundSwissData.groups.set(groupId, group);
      }

      group.matches.set(match.id, match);
    }

    for (const emptyMatchId of emptyMatchIds) {
      const match = bracketRound.matches.getOrThrow(emptyMatchId);
      const groups = [...roundSwissData.groups.values()];
      let group =
        groups.find((candidate) => candidate.matches.size < candidate.allowedMatchCount) ??
        groups.reduce<BracketRoundSwissGroup<TRoundData, TMatchData> | null>(
          (fewest, candidate) => (!fewest || candidate.matches.size < fewest.matches.size ? candidate : fewest),
          null,
        );

      // A round past the last one a 3-3 swiss can reach - the elimination rounds of a
      // swiss-with-elimination stage - has no record groups, and an undrawn match carries no record to
      // build one from. A nameless group keeps the round drawn instead of losing the whole bracket.
      if (!group) {
        group = { id: UNDRAWN_SWISS_GROUP_ID, name: '', matches: new BracketMap(), allowedMatchCount: 0 };
        roundSwissData.groups.set(group.id, group);
      }

      group.matches.set(match.id, match);
    }

    for (const [groupId, group] of roundSwissData.groups) {
      if (!group.matches.size) roundSwissData.groups.delete(groupId);
    }

    // The map is drawn top to bottom in insertion order, so a group created on demand has to be sorted
    // back into the best-record-first order the table was built in.
    const orderedGroups = [...roundSwissData.groups.entries()].sort(([a], [b]) => {
      const [aWins = 0, aLosses = 0] = a.split('-').map(Number);
      const [bWins = 0, bLosses = 0] = b.split('-').map(Number);

      return bWins - aWins || aLosses - bLosses;
    });

    roundSwissData.groups = new Map(orderedGroups);

    roundsWithSwissGroups.set(bracketRound.id, roundSwissData);

    roundNumber++;
  }

  return roundsWithSwissGroups;
};
