import { Evidence } from '../model/evidence';

/**
 * One copy of a commit: the `detail` its commit evidence carries and the lanes of the checkout it is in,
 * the one it was stored under first.
 */
export type CommitCopy = { detail: string; laneKeys: readonly string[] };

/**
 * The commit evidence of every copy but one, for each commit whose copies sit in rows. The copy kept is
 * the first in `copies` order that some row holds, so a commit only leaves a row when another copy of it
 * stays in one. Two copies with the same `detail` are told apart by the row's `laneKey`, an earlier
 * lane of a copy first.
 */
export const surplusCommitCopies = (options: {
  rows: readonly { laneKey?: string; evidence: readonly Evidence[] }[];
  copies: readonly (readonly CommitCopy[])[];
}): Set<Evidence> => {
  const named = new Map<string, { group: number; copy: number }[]>();

  options.copies.forEach((copies, group) =>
    copies.forEach((copy, index) =>
      named.set(copy.detail, [...(named.get(copy.detail) ?? []), { group, copy: index }]),
    ),
  );

  const held = new Map<number, Map<number, Evidence[]>>();

  for (const row of options.rows) {
    for (const entry of row.evidence) {
      const candidates = entry.kind === 'commit' ? named.get(entry.detail) : undefined;
      const laneRank = (candidate: { group: number; copy: number }) => {
        const rank = options.copies[candidate.group]?.[candidate.copy]?.laneKeys.indexOf(row.laneKey ?? '') ?? -1;

        return rank < 0 ? Infinity : rank;
      };
      const holder = candidates?.reduce((best, candidate) => (laneRank(candidate) < laneRank(best) ? candidate : best));

      if (!holder) continue;

      const ofGroup = held.get(holder.group) ?? new Map<number, Evidence[]>();

      ofGroup.set(holder.copy, [...(ofGroup.get(holder.copy) ?? []), entry]);
      held.set(holder.group, ofGroup);
    }
  }

  const kept = new Set<Evidence>();
  const surplus = new Set<Evidence>();

  for (const ofGroup of held.values()) {
    const keeper = Math.min(...ofGroup.keys());

    for (const [copy, entries] of ofGroup) for (const entry of entries) (copy === keeper ? kept : surplus).add(entry);
  }

  for (const entry of kept) surplus.delete(entry);

  return surplus;
};
