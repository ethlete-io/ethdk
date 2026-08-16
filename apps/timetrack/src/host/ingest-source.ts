import { IngestedRecord } from '@ethlete/timetrack';
import { Observable, map } from 'rxjs';
import { invokeHost$ } from './invoke';

type HostIngestRecord = {
  seq: number;
  atMs: number;
  reporter: string;
  kind: string;
  payload: Record<string, unknown>;
};

type HostIngestBatch = {
  events: HostIngestRecord[];
  nextSeq: number;
  dropped: number;
};

export type IngestReporterTally = {
  reporter: string;
  /** Records taken from this reporter since the app started, before any of them were interpreted. */
  received: number;
  /** When it last posted, by this machine's clock. */
  lastAtMs: number;
};

export type IngestStatus = {
  /** `listening` while the endpoint is bound, `none` when it could not be. */
  kind: string;
  detail: string | null;
  port: number | null;
  /** The file a reporter finds the endpoint through, for the row that has to tell the user where. */
  discoveryPath: string | null;
  reporters: IngestReporterTally[];
  /** Posts turned away for a missing or wrong token — usually a reporter left from an earlier run. */
  refused: number;
};

export type IngestBatch = {
  records: IngestedRecord[];
  /** The sequence to acknowledge once these are stored. Unchanged from the request when empty. */
  throughSeq: number;
  /** Records the host dropped because nothing drained it in time. A non-zero count is a real gap. */
  dropped: number;
};

/**
 * What reporters have posted to the local endpoint and nothing has stored yet.
 *
 * Nothing is released until `afterSeq` says it was stored, and nothing is interpreted here: a record
 * arrives exactly as its reporter wrote it, and `parseIngestedRecords` is what decides whether it is
 * an event at all.
 */
export type TauriIngestSource = {
  batch$(afterSeq: number): Observable<IngestBatch>;
  status$(): Observable<IngestStatus>;
};

export const createTauriIngestSource = (): TauriIngestSource => ({
  batch$: (afterSeq) =>
    invokeHost$<HostIngestBatch>('ingest_events', { afterSeq }).pipe(
      map((batch) => ({
        records: batch.events.map(({ reporter, atMs, kind, payload }): IngestedRecord => ({
          reporter,
          atMs,
          kind,
          payload,
        })),
        throughSeq: batch.events[batch.events.length - 1]?.seq ?? afterSeq,
        dropped: batch.dropped,
      })),
    ),
  status$: () => invokeHost$<IngestStatus>('ingest_status'),
});
