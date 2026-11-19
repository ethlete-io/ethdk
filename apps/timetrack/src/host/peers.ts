import {
  CheckoutKeys,
  PeerDayRows,
  PeerSharedSettings,
  ReceivedRange,
  SHARED_SETTINGS_DAY,
  SHARED_SETTINGS_DAY_START_MS,
  SharedSettingsEntry,
  encodePeerDayRows,
  encodeSharedSettings,
  mapSharedSettings,
  parsePeerDayRows,
  parseSharedSettings,
} from '@ethlete/timetrack';
import { Observable, map } from 'rxjs';
import { StoredEvent, reviveEvent } from './event-store';
import { invokeHost$ } from './invoke';

export type PairedMachine = {
  machineId: string;
  label: string;
  certFingerprint: string;
  lastAddr: string | null;
  lastSeenMs: number | null;
  /** How far the other machine's clock is ahead of this one's; negative when it is behind. */
  clockOffsetMs: number | null;
  pairedAtMs: number;
  /** When a pull from this machine last succeeded. */
  lastPullMs: number | null;
};

export type DiscoveredMachine = {
  machineId: string;
  label: string;
  addresses: string[];
  port: number;
  fingerprint: string;
  paired: boolean;
  lastSeenMs: number;
};

export type PairingOffer = { code: string; port: number; expiresAtMs: number };

export type PairTarget =
  { kind: 'discovered'; machineId: string } | { kind: 'address'; host: string; port: number | null };

export type PeerHello = {
  machineId: string;
  label: string;
  appVersion: string;
  clockOffsetMs: number;
  roundTripMs: number;
};

type StoredReceivedEvent = StoredEvent & { machineId: string; label: string };

type StoredReceivedRange = {
  events: StoredReceivedEvent[];
  repoKeys: { machineId: string; path: string; key: string }[];
  ownRepoKeys: { path: string; key: string }[];
  /** Absent from a host that predates day rows. */
  dayRows?: { machineId: string; day: string; rows: string; clockOffsetMs?: number | null }[];
};

/** The last rows a paired machine sent for a day, as that machine's checkouts name its lanes. */
export type ReceivedDayRows = { machineId: string; rows: PeerDayRows; clockOffsetMs?: number };

/**
 * A range's received events with each paired machine's checkout keys, this machine's own, and the rows
 * each paired machine last sent for the days that start in the range.
 */
export type HostReceivedRange = ReceivedRange & { ownRepoKeys: CheckoutKeys; dayRows: readonly ReceivedDayRows[] };

/** The rules and stand-ins each paired machine last sent, in this machine's checkouts, and this machine's own keys. */
export type HostReceivedSettings = { ownRepoKeys: CheckoutKeys; peers: readonly PeerSharedSettings[] };

const repoKeysOf = (stored: StoredReceivedRange) =>
  stored.repoKeys.reduce<Record<string, Record<string, string>>>((byMachine, row) => {
    (byMachine[row.machineId] ??= {})[row.path] = row.key;

    return byMachine;
  }, {});

const ownRepoKeysOf = (stored: StoredReceivedRange): CheckoutKeys =>
  Object.fromEntries(stored.ownRepoKeys.map((row) => [row.path, row.key]));

const receivedSettingsOf = (stored: StoredReceivedRange): HostReceivedSettings => {
  const repoKeys = repoKeysOf(stored);
  const ownRepoKeys = ownRepoKeysOf(stored);

  return {
    ownRepoKeys,
    peers: (stored.dayRows ?? []).flatMap((sent) => {
      const entries = sent.day === SHARED_SETTINGS_DAY ? parseSharedSettings(sent.rows) : null;

      return entries
        ? [
            {
              entries: mapSharedSettings({ entries, peerKeys: repoKeys[sent.machineId] ?? {}, localKeys: ownRepoKeys }),
              clockOffsetMs: sent.clockOffsetMs ?? 0,
            },
          ]
        : [];
    }),
  };
};

export const NOTHING_RECEIVED: HostReceivedRange = { events: [], repoKeys: {}, ownRepoKeys: {}, dayRows: [] };

export type TauriPeers = {
  list$(): Observable<PairedMachine[]>;
  discovered$(): Observable<DiscoveredMachine[]>;
  offer$(): Observable<PairingOffer>;
  accept$(target: PairTarget, code: string): Observable<PairedMachine>;
  hello$(machineId: string): Observable<PeerHello>;
  forget$(machineId: string): Observable<boolean>;
  /** An empty name clears it, so the machine reads under its host name again. */
  rename$(machineId: string, name: string): Observable<boolean>;
  /** The events the paired machines collected in `[from, to)`. A forgotten machine's are left out. */
  receivedBetween$(from: Date, to: Date): Observable<HostReceivedRange>;
  /** Replaces this machine's checkout keys, which every pull from here carries to the paired machine. */
  setRepoKeys$(keys: CheckoutKeys): Observable<void>;
  /** Replaces this machine's rows of a day starting at `dayStart`, which the next pull from here carries. */
  setDayRows$(rows: PeerDayRows, dayStart: Date): Observable<void>;
  /** This machine's stored rows of the days that start at or after `from`, in their wire form, by day. */
  ownDayRowsFrom$(from: Date): Observable<Readonly<Record<string, string>>>;
  /** The rules and stand-ins the paired machines last sent. */
  receivedSettings$(): Observable<HostReceivedSettings>;
  /** Replaces the rules and stand-ins of this machine that the next pull from here carries. */
  setSharedSettings$(entries: readonly SharedSettingsEntry[]): Observable<void>;
};

export const createTauriPeers = (): TauriPeers => ({
  list$: () => invokeHost$<PairedMachine[]>('peers_list'),
  discovered$: () => invokeHost$<DiscoveredMachine[]>('peers_discovered'),
  offer$: () => invokeHost$<PairingOffer>('pair_offer'),
  accept$: (target, code) => invokeHost$<PairedMachine>('pair_accept', { target, code }),
  hello$: (machineId) => invokeHost$<PeerHello>('peers_hello', { machineId }),
  forget$: (machineId) => invokeHost$<boolean>('peers_forget', { machineId }),
  rename$: (machineId, name) => invokeHost$<boolean>('peers_rename', { machineId, name }),
  receivedBetween$: (from, to) =>
    invokeHost$<StoredReceivedRange>('received_between', { fromMs: from.getTime(), toMs: to.getTime() }).pipe(
      map((stored) => ({
        events: stored.events.map((row) => ({
          machineId: row.machineId,
          machineName: row.label,
          event: reviveEvent(row),
        })),
        repoKeys: repoKeysOf(stored),
        ownRepoKeys: ownRepoKeysOf(stored),
        dayRows: (stored.dayRows ?? []).flatMap((sent) => {
          const rows = parsePeerDayRows(sent.rows);

          return rows
            ? [
                {
                  machineId: sent.machineId,
                  rows,
                  ...(sent.clockOffsetMs ? { clockOffsetMs: sent.clockOffsetMs } : {}),
                },
              ]
            : [];
        }),
      })),
    ),
  setRepoKeys$: (keys) =>
    invokeHost$<void>('set_repo_keys', { keys: Object.entries(keys).map(([path, key]) => ({ path, key })) }),
  setDayRows$: (rows, dayStart) =>
    invokeHost$<void>('set_day_rows', {
      rows: { day: rows.day, dayStartMs: dayStart.getTime(), rows: encodePeerDayRows(rows) },
    }),
  ownDayRowsFrom$: (from) =>
    invokeHost$<{ day: string; rows: string }[]>('own_day_rows', { fromMs: from.getTime() }).pipe(
      map((stored) => Object.fromEntries(stored.map((sent) => [sent.day, sent.rows]))),
    ),
  receivedSettings$: () =>
    invokeHost$<StoredReceivedRange>('received_between', {
      fromMs: SHARED_SETTINGS_DAY_START_MS,
      toMs: SHARED_SETTINGS_DAY_START_MS + 1,
    }).pipe(map(receivedSettingsOf)),
  setSharedSettings$: (entries) =>
    invokeHost$<void>('set_day_rows', {
      rows: { day: SHARED_SETTINGS_DAY, dayStartMs: SHARED_SETTINGS_DAY_START_MS, rows: encodeSharedSettings(entries) },
    }),
});
