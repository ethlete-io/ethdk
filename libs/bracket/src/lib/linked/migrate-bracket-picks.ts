import { Bracket, BracketMatch } from './bracket';
import { BracketPickSet, BracketSlotResolutionPolicy, resolveBracketSlot } from './resolve-bracket-slot';

export type BracketPickMigrationOptions = BracketSlotResolutionPolicy & {
  bracket: Bracket<unknown, unknown>;
  /** The participant the viewer picked on a match, on the match they picked it on. */
  pickAsMade: (matchId: string) => string | null;
  /** The participant the viewer put on a table position, for the `standing-rank` slots a round resolves from. */
  standingRank?: (options: { standingId: string; rank: number }) => string | null;
  /** Matches whose picks the backend already keeps. Their picks neither travel out nor take one in. */
  lockedMatchIds?: ReadonlySet<string>;
};

export type BracketPickMigration = {
  /** The pick that counts on a match: the one made on it, or the one that followed its participant here. */
  pickByMatchId: Record<string, string | undefined>;
  /** For a match that took a pick in, the match that pick was made on. */
  movedFromByMatchId: Record<string, string | undefined>;
  /** For a match whose pick nothing in its round can honour, that pick. Such a match holds no selection. */
  strandedByMatchId: Record<string, string | undefined>;
};

// Grouped by type and depth rather than by round id: a mirrored layout splits one round into two
// half-rounds to draw either side of the fold, and a pick has to be able to travel across it. Ordered
// topologically over the declared provenance, because a round is settled against the ones feeding it.
const roundsOf = (bracket: Bracket<unknown, unknown>): BracketMatch<unknown, unknown>[][] => {
  const matchesByKey = new Map<string, BracketMatch<unknown, unknown>[]>();
  const keyByMatchId = new Map<string, string>();

  for (const round of bracket.rounds.values()) {
    const key = `${round.type}:${round.logicalIndex}`;
    const matches = matchesByKey.get(key) ?? [];

    for (const match of round.matches.values()) {
      matches.push(match);
      keyByMatchId.set(match.id, key);
    }

    matchesByKey.set(key, matches);
  }

  const unsettledFeedersByKey = new Map<string, Set<string>>();

  for (const [key, matches] of matchesByKey) {
    const feeders = new Set<string>();

    for (const match of matches) {
      for (const source of [match.homeSource, match.awaySource]) {
        if (source?.kind !== 'match-outcome' || !source.matchId) continue;

        const feederKey = keyByMatchId.get(source.matchId);

        if (feederKey !== undefined && feederKey !== key) feeders.add(feederKey);
      }
    }

    unsettledFeedersByKey.set(key, feeders);
  }

  const ordered: BracketMatch<unknown, unknown>[][] = [];

  while (unsettledFeedersByKey.size) {
    const keys = [...unsettledFeedersByKey.keys()];
    // A malformed graph can leave a cycle in which nothing is ready, so fall back to the first
    // round left rather than looping forever.
    const key = keys.find((candidate) => !unsettledFeedersByKey.get(candidate)?.size) ?? keys[0];

    if (key === undefined) break;

    ordered.push(matchesByKey.get(key) ?? []);
    unsettledFeedersByKey.delete(key);

    for (const feeders of unsettledFeedersByKey.values()) feeders.delete(key);
  }

  return ordered;
};

/**
 * Where every pick stands once each one has followed its participant into whichever match of its own
 * round that participant now plays. A pick nothing in the round can honour comes back stranded.
 */
export const migrateBracketPicks = (options: BracketPickMigrationOptions): BracketPickMigration => {
  const { bracket, pickAsMade } = options;
  const locked = options.lockedMatchIds ?? new Set<string>();
  const pickByMatchId: Record<string, string | undefined> = {};
  const movedFromByMatchId: Record<string, string | undefined> = {};
  const strandedByMatchId: Record<string, string | undefined> = {};

  const settled: BracketPickSet = {
    matchWinner: (matchId) => pickByMatchId[matchId] ?? null,
    standingRank: options.standingRank ?? (() => null),
  };

  for (const round of roundsOf(bracket)) {
    const sidesByMatchId = new Map<string, [string | null, string | null]>();
    const travelling: { matchId: string; pick: string }[] = [];
    const strandedHere = new Set<string>();
    const sidesOf = (matchId: string) => sidesByMatchId.get(matchId) ?? [null, null];

    for (const match of round) {
      const resolve = (side: 'home' | 'away') =>
        resolveBracketSlot({
          bracket,
          picks: settled,
          matchId: match.id,
          side,
          realParticipantOutranksPick: options.realParticipantOutranksPick,
          keepPickWhileFeederSideIsOpen: options.keepPickWhileFeederSideIsOpen,
        });

      sidesByMatchId.set(match.id, [resolve('home'), resolve('away')]);
    }

    for (const match of round) {
      const pick = pickAsMade(match.id);

      if (!pick) continue;

      const [home, away] = sidesOf(match.id);

      if (pick === home || pick === away) {
        pickByMatchId[match.id] = pick;

        continue;
      }

      if (locked.has(match.id)) {
        pickByMatchId[match.id] = pick;
        strandedByMatchId[match.id] = pick;

        continue;
      }

      travelling.push({ matchId: match.id, pick });
    }

    for (const { matchId, pick } of travelling) {
      const target = round.find((candidate) => {
        if (candidate.id === matchId || locked.has(candidate.id) || pickByMatchId[candidate.id]) return false;
        if (strandedHere.has(candidate.id)) return false;

        const [home, away] = sidesOf(candidate.id);

        return pick === home || pick === away;
      });

      if (!target) {
        strandedByMatchId[matchId] = pick;
        strandedHere.add(matchId);

        continue;
      }

      pickByMatchId[target.id] = pick;
      movedFromByMatchId[target.id] = matchId;
    }

    // After the travelling, not during it: a match that carries the stranded note holds no selection
    // at all, even where a pick reached it in the meantime.
    for (const matchId of strandedHere) delete pickByMatchId[matchId];
  }

  return { pickByMatchId, movedFromByMatchId, strandedByMatchId };
};
