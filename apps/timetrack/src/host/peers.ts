import { CheckoutKeys, ReceivedRange } from '@ethlete/timetrack';
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
};

/** A range's received events with each paired machine's checkout keys, and this machine's own. */
export type HostReceivedRange = ReceivedRange & { ownRepoKeys: CheckoutKeys };

export const NOTHING_RECEIVED: HostReceivedRange = { events: [], repoKeys: {}, ownRepoKeys: {} };

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
        repoKeys: stored.repoKeys.reduce<Record<string, Record<string, string>>>((byMachine, row) => {
          (byMachine[row.machineId] ??= {})[row.path] = row.key;

          return byMachine;
        }, {}),
        ownRepoKeys: Object.fromEntries(stored.ownRepoKeys.map((row) => [row.path, row.key])),
      })),
    ),
  setRepoKeys$: (keys) =>
    invokeHost$<void>('set_repo_keys', { keys: Object.entries(keys).map(([path, key]) => ({ path, key })) }),
});
