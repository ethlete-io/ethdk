import { SharedStamp } from './model';

/** Anything that travels to paired machines stamped in the sender's clock. */
export type StampedEntry = { id: string; atMs: number; kind: string };

/** A paired machine's stamped entries and how far its clock is ahead of this one's. */
export type PeerStampedEntries<T extends StampedEntry> = { entries: readonly T[]; clockOffsetMs: number };

/** Per id, the latest entry of all `peers`, each stamp moved onto this machine's clock (ADR 0041 pt 2). */
export const latestPeerEntries = <T extends StampedEntry>(peers: readonly PeerStampedEntries<T>[]): Map<string, T> => {
  const latest = new Map<string, T>();

  for (const peer of peers) {
    for (const entry of peer.entries) {
      const atMs = entry.atMs - peer.clockOffsetMs;
      const held = latest.get(entry.id);

      if (!held || atMs > held.atMs) latest.set(entry.id, { ...entry, atMs });
    }
  }

  return latest;
};

/**
 * Whether a peer's entry beats what this machine holds: a later stamp wins and a tie keeps this machine's.
 * A subject this machine never stamped counts as oldest, and a removal of what it already removed changes nothing.
 */
export const peerEntryWins = (options: { entry: StampedEntry; held: boolean; stamp?: SharedStamp }) => {
  const { entry, held, stamp } = options;

  if (entry.atMs <= (stamp?.atMs ?? (held ? 0 : -Infinity))) return false;

  return !(entry.kind === 'deleted' && !held && stamp?.deleted);
};

/** The stamps of every subject whose body changed between `was` and `now`, and of every one removed. */
export const changedStamps = (options: {
  was: ReadonlyMap<string, string>;
  now: ReadonlyMap<string, string>;
  atMs: number;
}): Record<string, SharedStamp> => {
  const changed: Record<string, SharedStamp> = {};

  for (const [id, body] of options.now) {
    if (options.was.get(id) !== body) changed[id] = { atMs: options.atMs };
  }

  for (const id of options.was.keys()) {
    if (!options.now.has(id)) changed[id] = { atMs: options.atMs, deleted: true };
  }

  return changed;
};

/** The removals `stamps` records of subjects no longer in `live`. */
export const tombstonesOf = (stamps: Readonly<Record<string, SharedStamp>>, live: ReadonlyMap<string, unknown>) =>
  Object.entries(stamps)
    .filter(([id, stamp]) => stamp.deleted && !live.has(id))
    .map(([id, stamp]) => ({ id, atMs: stamp.atMs, kind: 'deleted' as const }));
