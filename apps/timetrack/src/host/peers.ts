import { Observable } from 'rxjs';
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

export type TauriPeers = {
  list$(): Observable<PairedMachine[]>;
  discovered$(): Observable<DiscoveredMachine[]>;
  offer$(): Observable<PairingOffer>;
  accept$(target: PairTarget, code: string): Observable<PairedMachine>;
  hello$(machineId: string): Observable<PeerHello>;
  forget$(machineId: string): Observable<boolean>;
};

export const createTauriPeers = (): TauriPeers => ({
  list$: () => invokeHost$<PairedMachine[]>('peers_list'),
  discovered$: () => invokeHost$<DiscoveredMachine[]>('peers_discovered'),
  offer$: () => invokeHost$<PairingOffer>('pair_offer'),
  accept$: (target, code) => invokeHost$<PairedMachine>('pair_accept', { target, code }),
  hello$: (machineId) => invokeHost$<PeerHello>('peers_hello', { machineId }),
  forget$: (machineId) => invokeHost$<boolean>('peers_forget', { machineId }),
});
