import { Observable, map } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { TempoCredentials, TempoRequestError, tempoRequest$ } from './client';
import { tempoDay, tempoTimeOfDay } from './wall-clock';

/** Everything a worklog write sends. Attribute values are already resolved: nothing here guesses one. */
export type TempoWorklogWrite = {
  authorAccountId: string;
  /** Tempo references the numeric Jira issue id, never the key. */
  issueId: string;
  from: Date;
  durationMs: number;
  billableMs?: number;
  description: string;
  attributes?: Record<string, string | number | boolean>;
};

const asSeconds = (ms: number) => Math.round(ms / 1000);

const attributeValues = (attributes: Record<string, string | number | boolean> | undefined) =>
  Object.entries(attributes ?? {}).map(([key, value]) => ({ key, value }));

const timeFields = (write: TempoWorklogWrite) => ({
  startDate: tempoDay(write.from),
  startTime: tempoTimeOfDay(write.from),
  timeSpentSeconds: asSeconds(write.durationMs),
  ...(write.billableMs === undefined ? {} : { billableSeconds: asSeconds(write.billableMs) }),
  description: write.description,
  attributes: attributeValues(write.attributes),
});

/**
 * Creates one worklog and answers with the Tempo worklog id, which is what the ledger stores to own it
 * from then on.
 */
export const createTempoWorklog$ = (options: {
  transport: TimetrackTransport;
  credentials: TempoCredentials;
  write: TempoWorklogWrite;
}): Observable<string> => {
  const describe = `the new worklog on issue ${options.write.issueId}`;

  return tempoRequest$<{ tempoWorklogId?: number | string }>({
    transport: options.transport,
    credentials: options.credentials,
    path: '/worklogs',
    method: 'POST',
    describe,
    body: {
      authorAccountId: options.write.authorAccountId,
      issueId: Number(options.write.issueId),
      ...timeFields(options.write),
    },
  }).pipe(
    map((created) => {
      if (created.tempoWorklogId === undefined) {
        throw new TempoRequestError({
          status: 200,
          describe,
          message: `Tempo accepted ${describe} but returned no worklog id, so it cannot be owned.`,
        });
      }

      return String(created.tempoWorklogId);
    }),
  );
};

/**
 * Replaces one worklog's content. Tempo v4 cannot move a worklog to another issue, so `issueId` is
 * deliberately not part of the body — a proposal that changed issue is a delete plus a create, which
 * is what `planTempoSync` emits for it.
 */
export const updateTempoWorklog$ = (options: {
  transport: TimetrackTransport;
  credentials: TempoCredentials;
  tempoWorklogId: string;
  write: TempoWorklogWrite;
}): Observable<void> =>
  tempoRequest$<unknown>({
    transport: options.transport,
    credentials: options.credentials,
    path: `/worklogs/${encodeURIComponent(options.tempoWorklogId)}`,
    method: 'PUT',
    describe: `worklog ${options.tempoWorklogId}`,
    body: {
      authorAccountId: options.write.authorAccountId,
      ...timeFields(options.write),
    },
  }).pipe(map(() => undefined));

export const deleteTempoWorklog$ = (options: {
  transport: TimetrackTransport;
  credentials: TempoCredentials;
  tempoWorklogId: string;
}): Observable<void> =>
  tempoRequest$<unknown>({
    transport: options.transport,
    credentials: options.credentials,
    path: `/worklogs/${encodeURIComponent(options.tempoWorklogId)}`,
    method: 'DELETE',
    describe: `worklog ${options.tempoWorklogId}`,
  }).pipe(map(() => undefined));
