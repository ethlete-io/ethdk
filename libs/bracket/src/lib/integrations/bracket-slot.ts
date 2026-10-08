import {
  BracketByeSlotSource,
  BracketExternalSlotSource,
  BracketMatchOutcomeSlotSource,
  BracketSeedSlotSource,
  BracketStandingRankSlotSource,
  BracketSwissBucketSlotSource,
} from './base';

/**
 * Constructors for every {@link BracketSlotSource} kind, each taking an optional competition `label`.
 *
 * @example
 * homeSource: bracketSlot.matchOutcome('semi-final-1', 'winner'),
 * awaySource: bracketSlot.standingRank('group-a', 2, 'Group A'),
 */
export const bracketSlot = {
  // eslint-disable-next-line max-params -- positional slot constructors read like the slot they build
  matchOutcome: (
    matchId: string,
    role: 'winner' | 'loser',
    label: string | null = null,
  ): BracketMatchOutcomeSlotSource => ({ kind: 'match-outcome', matchId, role, label }),
  // eslint-disable-next-line max-params -- positional slot constructors read like the slot they build
  standingRank: (
    standingId: string,
    rank: number,
    standingName: string | null = null,
    label: string | null = null,
  ): BracketStandingRankSlotSource => ({ kind: 'standing-rank', standingId, rank, standingName, label }),
  seed: (seed: number, label: string | null = null): BracketSeedSlotSource => ({ kind: 'seed', seed, label }),
  swissBucket: (label: string | null = null): BracketSwissBucketSlotSource => ({ kind: 'swiss-bucket', label }),
  bye: (label: string | null = null): BracketByeSlotSource => ({ kind: 'bye', label }),
  external: (label: string): BracketExternalSlotSource => ({ kind: 'external', label }),
} as const;
