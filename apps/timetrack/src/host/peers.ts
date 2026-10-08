import { ReceivedEvent } from '@ethlete/timetrack';
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

export type TauriPeers = {
  list$(): Observable<PairedMachine[]>;
  discovered$(): Observable<DiscoveredMachine[]>;
  offer$(): Observable<PairingOffer>;
  accept$(target: PairTarget, code: string): Observable<PairedMachine>;
  hello$(machineId: string): Observable<PeerHello>;
  forget$(machineId: string): Observable<boolean>;
  /** The events the paired machines collected in `[from, to)`. A forgotten machine's are left out. */
  receivedBetween$(from: Date, to: Date): Observable<ReceivedEvent[]>;
};

export const createTauriPeers = (): TauriPeers => ({
  list$: () => invokeHost$<PairedMachine[]>('peers_list'),
  discovered$: () => invokeHost$<DiscoveredMachine[]>('peers_discovered'),
  offer$: () => invokeHost$<PairingOffer>('pair_offer'),
  accept$: (target, code) => invokeHost$<PairedMachine>('pair_accept', { target, code }),
  hello$: (machineId) => invokeHost$<PeerHello>('peers_hello', { machineId }),
  forget$: (machineId) => invokeHost$<boolean>('peers_forget', { machineId }),
  receivedBetween$: (from, to) =>
    invokeHost$<StoredReceivedEvent[]>('received_between', { fromMs: from.getTime(), toMs: to.getTime() }).pipe(
      map((stored) =>
        stored.map((row) => ({ machineId: row.machineId, machineName: row.label, event: reviveEvent(row) })),
      ),
    ),
});
