/**
 * Namespace of the probe lock the panel holds while the Locks tab is open. `LockInfo` carries a
 * `clientId` but there is no API for "my own", so a lock under a name only this tab can have produced is
 * the only way to learn it - and without it every row would say _some tab_ rather than _this tab_.
 */
export const DEVTOOLS_PROBE_NAMESPACE = 'ethlete-devtools';

export const devtoolsProbeLockKey = (id: string) => `probe:${id}`;

export const devtoolsProbeLockName = (id: string) => `${DEVTOOLS_PROBE_NAMESPACE}:${devtoolsProbeLockKey(id)}`;

const PROBE_PREFIX = `${DEVTOOLS_PROBE_NAMESPACE}:probe:`;
const AUTH_PREFIX = 'ethlete-auth:leader:';
const POLL_PREFIX = 'et-query-poll:';

/** Which SDK feature a lock name belongs to, or `other` for one the panel did not put there. */
export type DevtoolsLockKind = 'auth' | 'poll' | 'other';

/** Where the tab the panel is open in stands on one lock. */
export type DevtoolsLockStanding = 'holder' | 'queued' | 'absent' | 'unknown';

/** One lock name, with every client that holds or waits for it folded into a single row. */
export type DevtoolsLockRow = {
  /** The raw name, so a lock the panel cannot decode is still greppable from the row. */
  name: string;

  /** What the name means: the provider for an auth lock, the cache key for a poll lock. */
  label: string;

  kind: DevtoolsLockKind;

  /** The sync channel a poll lock belongs to, or `null` for a name that carries no such part. */
  channel: string | null;

  /**
   * Held plus queued on this name. Every participant requests the same lock and exactly one gets it, so
   * this is the number of tabs, workers and service workers taking part - the same arithmetic the auth
   * provider's own `instanceCount` does.
   */
  tabs: number;

  standing: DevtoolsLockStanding;

  /** This tab's 1-based place in the queue, or `null` unless {@link standing} is `queued`. */
  queuePlace: number | null;
};

const decode = (name: string): Pick<DevtoolsLockRow, 'kind' | 'label' | 'channel'> => {
  if (name.startsWith(AUTH_PREFIX)) return { kind: 'auth', label: name.slice(AUTH_PREFIX.length), channel: null };

  if (name.startsWith(POLL_PREFIX)) {
    const rest = name.slice(POLL_PREFIX.length);
    const separator = rest.indexOf(':');

    return separator === -1
      ? { kind: 'poll', label: rest, channel: null }
      : { kind: 'poll', label: rest.slice(separator + 1), channel: rest.slice(0, separator) };
  }

  return { kind: 'other', label: name, channel: null };
};

const KIND_ORDER: Record<DevtoolsLockKind, number> = { auth: 0, poll: 1, other: 2 };

/** The `clientId` of the tab the panel is open in, read off the probe lock it holds under `probeName`. */
export const probeClientId = (snapshot: LockManagerSnapshot, probeName: string): string | null =>
  snapshot.held?.find((info) => info.name === probeName)?.clientId ?? null;

/**
 * Folds an origin-wide `navigator.locks.query()` snapshot into one row per lock name, decoded to the
 * feature that took it and marked with where this tab stands on it.
 *
 * Probe locks are dropped from the result - every open panel on the origin holds one, and they describe
 * the inspector rather than the app it inspects.
 */
export const summarizeLocks = (options: {
  snapshot: LockManagerSnapshot;
  /** This tab's client id, or `null` while the probe has not been granted - see {@link DevtoolsLockStanding}. */
  clientId: string | null;
}): DevtoolsLockRow[] => {
  const { snapshot, clientId } = options;

  const held = (snapshot.held ?? []).filter((info) => !info.name?.startsWith(PROBE_PREFIX));
  const pending = (snapshot.pending ?? []).filter((info) => !info.name?.startsWith(PROBE_PREFIX));

  const names = [...new Set([...held, ...pending].map((info) => info.name ?? ''))];

  const rows = names.map((name): DevtoolsLockRow => {
    const holders = held.filter((info) => info.name === name);
    const queue = pending.filter((info) => info.name === name);
    const place = queue.findIndex((info) => info.clientId === clientId) + 1;
    const isHolder = holders.some((info) => info.clientId === clientId);

    const standing: DevtoolsLockStanding =
      clientId === null ? 'unknown' : isHolder ? 'holder' : place > 0 ? 'queued' : 'absent';

    return {
      name,
      ...decode(name),
      tabs: holders.length + queue.length,
      standing,
      queuePlace: standing === 'queued' ? place : null,
    };
  });

  return rows.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.label.localeCompare(b.label));
};
