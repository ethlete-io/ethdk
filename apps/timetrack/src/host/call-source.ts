import { CallEvent, CollectedEvent } from '@ethlete/timetrack';
import { Observable, map } from 'rxjs';
import { invokeHost$ } from './invoke';

type HostCallEvent = { seq: number; atMs: number; kind: 'call-start' | 'call-end'; appId: string };

type HostCallBatch = {
  events: HostCallEvent[];
  nextSeq: number;
  dropped: number;
};

export type CallSourceStatus = {
  /** `macos-core-audio` while CoreAudio is watching, `none` when nothing is watching. */
  kind: string;
  detail: string | null;
};

export type CallBatch = {
  events: CollectedEvent[];
  /** The sequence to acknowledge once these are stored. Unchanged from the request when empty. */
  throughSeq: number;
  /** Samples the host dropped because nothing drained it in time. A non-zero count is a real gap. */
  dropped: number;
};

const reviveEvent = (event: HostCallEvent): CollectedEvent =>
  ({
    at: new Date(event.atMs),
    source: 'call',
    kind: event.kind,
    appId: event.appId,
  }) satisfies CallEvent;

/**
 * The host's buffer of microphone edges — which process took the microphone, and when it let go.
 *
 * Nothing is released until `afterSeq` says it was stored, so a reload between reading and storing
 * repeats a sample rather than losing it.
 */
export type TauriCallSource = {
  batch$(afterSeq: number): Observable<CallBatch>;
  status$(): Observable<CallSourceStatus>;
};

export const createTauriCallSource = (): TauriCallSource => ({
  batch$: (afterSeq) =>
    invokeHost$<HostCallBatch>('call_events', { afterSeq }).pipe(
      map((batch) => ({
        events: batch.events.map(reviveEvent),
        throughSeq: batch.events[batch.events.length - 1]?.seq ?? afterSeq,
        dropped: batch.dropped,
      })),
    ),
  status$: () => invokeHost$<CallSourceStatus>('call_source_status'),
});
