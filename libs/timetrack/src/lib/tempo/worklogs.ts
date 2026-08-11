import { Observable, map } from 'rxjs';
import { HistoricalWorklog } from '../correlate/recurrence';
import { TimetrackTransport } from '../transport/ports';
import { TempoCredentials, TempoPagingOptions, tempoPaged$ } from './client';
import { parseTempoWallClock, tempoDay } from './wall-clock';

/** One worklog as it exists in Tempo, normalized. Times are the user's wall clock, as Tempo sends them. */
export type TempoWorklog = {
  id: string;
  /** Tempo references the numeric issue id, never the key. Resolving it needs Jira. */
  issueId: string;
  authorAccountId: string;
  from: Date;
  durationMs: number;
  billableMs: number;
  description: string;
  /** The work-attribute values this worklog carries, keyed by attribute key. */
  attributes: Record<string, string>;
};

type TempoWorklogResource = {
  tempoWorklogId?: number | string;
  issue?: { id?: number | string };
  timeSpentSeconds?: number;
  billableSeconds?: number;
  startDate?: string;
  startTime?: string;
  description?: string;
  author?: { accountId?: string };
  attributes?: { values?: { key?: string; value?: unknown }[] };
};

const toAttributeValues = (resource: TempoWorklogResource) => {
  const values: Record<string, string> = {};

  for (const value of resource.attributes?.values ?? []) {
    if (value.key && value.value !== undefined && value.value !== null) values[value.key] = String(value.value);
  }

  return values;
};

const toWorklog = (resource: TempoWorklogResource): TempoWorklog | undefined => {
  const from = parseTempoWallClock(resource.startDate, resource.startTime);

  if (resource.tempoWorklogId === undefined || resource.issue?.id === undefined || !from) return undefined;

  return {
    id: String(resource.tempoWorklogId),
    issueId: String(resource.issue.id),
    authorAccountId: resource.author?.accountId ?? '',
    from,
    durationMs: (resource.timeSpentSeconds ?? 0) * 1000,
    billableMs: (resource.billableSeconds ?? 0) * 1000,
    description: resource.description ?? '',
    attributes: toAttributeValues(resource),
  };
};

/**
 * Reads one user's worklogs over a range of days. This is the read side of the whole Tempo
 * integration: what it returns is already-accounted time, whoever wrote it, and the app subtracts it
 * from what it proposes rather than logging the same hour twice.
 *
 * `from` and `to` are inclusive days, not instants — Tempo's range is date-based.
 */
export const fetchTempoWorklogs$ = (options: {
  transport: TimetrackTransport;
  credentials: TempoCredentials;
  accountId: string;
  from: Date;
  to: Date;
  options?: Partial<TempoPagingOptions>;
}): Observable<TempoWorklog[]> =>
  tempoPaged$<TempoWorklogResource>({
    transport: options.transport,
    credentials: options.credentials,
    path: `/worklogs/user/${encodeURIComponent(options.accountId)}`,
    describe: `worklogs for ${tempoDay(options.from)}…${tempoDay(options.to)}`,
    query: { from: tempoDay(options.from), to: tempoDay(options.to) },
    options: options.options,
  }).pipe(map((resources) => resources.flatMap((resource) => toWorklog(resource) ?? [])));

/**
 * The history feed `detectRecurringPatterns` reads. A worklog whose issue id is not in the map is
 * dropped: the recurrence rung keys on the issue key, and an unresolvable id cannot attribute
 * anything.
 */
export const toHistoricalWorklogs = (options: {
  worklogs: TempoWorklog[];
  keysByIssueId: Map<string, string>;
}): HistoricalWorklog[] =>
  options.worklogs.flatMap((worklog) => {
    const issueKey = options.keysByIssueId.get(worklog.issueId);

    return issueKey ? [{ issueKey, from: worklog.from, durationMs: worklog.durationMs }] : [];
  });
