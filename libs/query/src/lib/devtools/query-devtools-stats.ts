import { HttpHeaders } from '@angular/common/http';
import { Signal, signal } from '@angular/core';

/**
 * What a query did over its lifetime, as the devtools panel accounts for it: how often it ran, how many
 * of those runs reached the network, and how much payload they moved.
 */
export type QueryDevtoolsStats = {
  /** How often the query executed, whether or not that reached the network. */
  executions: number;

  /**
   * How many of those executions started a request. The remainder were answered by a fresh cache entry
   * or joined a request that was already in flight.
   */
  requests: number;

  /** How many responses arrived over the network. */
  responses: number;

  /** How many requests failed. */
  errors: number;

  /**
   * How many attempts the retry policy added on top of the first one. A request that succeeded on its
   * third attempt counts two.
   */
  retries: number;

  /** The total size of every response body received. */
  receivedBytes: number;

  /** The total size of every request body sent. */
  sentBytes: number;

  /**
   * Whether any byte count had to be measured from a body instead of read from a `content-length`
   * header. A serialized body is the decoded payload, so it does not account for transport compression -
   * the real transfer was probably smaller.
   */
  hasEstimatedBytes: boolean;

  /** When the query executed for the first time. */
  firstExecutedAt: number | null;

  /** When its last response arrived. */
  lastResponseAt: number | null;

  /**
   * How long the last response took, measured from the execution that preceded it - so it includes the
   * retry delays and the queueing wall clock time, not just the round trip.
   */
  lastDurationMs: number | null;

  /** The sum of every response's duration, which together with {@link responses} gives the average. */
  totalDurationMs: number;

  /**
   * Whether the query's last completed run ended in a devtools fault rather than a real server
   * response or failure - the fact the panel's tamper indicator badges on. Cleared by the next real
   * response; a run that exhausts its retries on a real error also clears it, since nothing about that
   * outcome was altered by the devtools.
   */
  lastResponseWasFaulted: boolean;
};

const EMPTY_STATS: QueryDevtoolsStats = {
  executions: 0,
  requests: 0,
  responses: 0,
  errors: 0,
  retries: 0,
  receivedBytes: 0,
  sentBytes: 0,
  hasEstimatedBytes: false,
  firstExecutedAt: null,
  lastResponseAt: null,
  lastDurationMs: null,
  totalDurationMs: 0,
  lastResponseWasFaulted: false,
};

/** A payload whose transferred size is to be measured, plus the headers it came with (if any). */
export type QueryDevtoolsPayload = {
  headers?: HttpHeaders | null;
  body: unknown;
};

/**
 * How one run of a query ended. `aborted` is a run whose query started another request before the
 * response arrived - the previous request's events are unbound at that point, so the response it was
 * waiting for can no longer reach it.
 */
export type QueryDevtoolsRunStatus = 'pending' | 'success' | 'error' | 'aborted';

/**
 * A single run of a query, kept alongside the running totals so overlapping runs stay tellable apart -
 * which is what turns "ran 40 times" into "ran 40 times in two seconds".
 */
export type QueryDevtoolsRun = {
  /**
   * Position in the query's lifetime, 1-based. Keeps climbing past the runs the buffer has dropped, so
   * it is a stable identity as well as a run number.
   */
  index: number;

  startedAt: number;

  /** When the run ended, or `null` while it is still in flight. */
  endedAt: number | null;

  status: QueryDevtoolsRunStatus;

  /**
   * Whether this run is a request of the query's own. A response that arrives without one was produced
   * by something else - a poll, another consumer of the same cache entry, another tab - and is recorded
   * as an instant, since only its arrival time is knowable.
   */
  didRequest: boolean;

  /**
   * The URL this run went to. Kept per run rather than read off the query: a query whose args changed
   * between runs would otherwise label every older run with the URL it happens to hold now.
   */
  url: string | null;

  /**
   * How many HTTP attempts this run took - 1 unless the retry policy fired, and 0 for a run that made no
   * request of its own. Which is what tells a slow response apart from one that was retried into place.
   */
  attempts: number;

  /** The size of the request body this run sent. */
  sentBytes: number;

  /** The size of the response body it received, or 0 until one has. */
  receivedBytes: number;

  /**
   * The response body, so one run can be diffed against another. Only the newest few runs keep theirs -
   * a polling query would otherwise retain every response it ever received.
   */
  response: unknown;

  /** Whether {@link response} still holds this run's body; a dropped and an empty body both read `null`. */
  hasResponse: boolean;
};

/** The read side of a stats recorder, as a {@link QueryDevtoolsEntry} exposes it to the panel. */
export type QueryDevtoolsStatsHandle = {
  /** The live stats. */
  current: Signal<QueryDevtoolsStats>;

  /** The query's most recent runs, oldest first. Bounded - older runs are dropped as new ones arrive. */
  runs: Signal<readonly QueryDevtoolsRun[]>;

  /** Clears every counter, so a measurement can be scoped to a single interaction. */
  reset: () => void;
};

/** The write side, used by the instrumentation inside the query itself. */
export type QueryDevtoolsStatsRecorder = QueryDevtoolsStatsHandle & {
  recordExecution: (options: {
    /** Whether the execution started a request, as reported by the repository. */
    didRequest: boolean;

    /** The request body it sent, for the outgoing byte count. */
    body?: unknown;

    /** The URL it went to. @see QueryDevtoolsRun.url */
    url?: string;
  }) => void;

  recordResponse: (payload: QueryDevtoolsPayload) => void;

  recordError: (options?: { faulted?: boolean }) => void;

  /**
   * Raises the attempt count of the run in flight. Idempotent per attempt, so a caller driven off a
   * signal may report the same attempt more than once without inflating {@link QueryDevtoolsStats.retries}.
   */
  recordRetry: (options: { attempt: number }) => void;
};

const textEncoder = typeof TextEncoder === 'function' ? /* @__PURE__ */ new TextEncoder() : null;

const byteLengthOf = (text: string) => textEncoder?.encode(text).length ?? text.length;

const estimateBodySize = (body: unknown) => {
  if (body === null || body === undefined) return 0;
  if (typeof body === 'string') return byteLengthOf(body);
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return 0;

  try {
    return byteLengthOf(JSON.stringify(body) ?? '');
  } catch {
    // A body holding a circular reference or a BigInt has no serialized size to report.
    return 0;
  }
};

/** How many runs a query keeps. Enough to see a stampede or a chain without growing unbounded. */
const RUN_HISTORY = 25;

/**
 * How many of those runs keep their response body. Bodies dominate what the buffer retains, and a diff
 * only ever looks a couple of runs back.
 */
const RESPONSE_HISTORY = 5;

/** The index of the newest run still in flight, or -1 when none is. */
const lastPendingRunIndex = (runs: readonly QueryDevtoolsRun[]) => {
  for (let index = runs.length - 1; index >= 0; index--) {
    if (runs[index]?.status === 'pending') return index;
  }

  return -1;
};

/**
 * Drops the response body of every run past the newest {@link RESPONSE_HISTORY} that hold one. Mutates
 * the array it is given, which is always one this module just built.
 */
const trimRetainedResponses = (runs: QueryDevtoolsRun[]) => {
  let kept = 0;

  for (let index = runs.length - 1; index >= 0; index--) {
    const run = runs[index];

    if (!run?.hasResponse) continue;
    if (++kept > RESPONSE_HISTORY) runs[index] = { ...run, response: null, hasResponse: false };
  }

  return runs;
};

/**
 * The size of a payload in bytes, and whether that size is the one that went over the wire. Only a
 * `content-length` header is exact; everything else is measured by serializing the body.
 *
 * Part of the devtools contract - the panel measures the cache and the event log with it. **Not part of
 * the general public contract.**
 */
export const measureQueryDevtoolsPayload = (payload: QueryDevtoolsPayload): { bytes: number; isExact: boolean } => {
  const contentLength = Number(payload.headers?.get('content-length'));

  if (Number.isFinite(contentLength) && contentLength > 0) return { bytes: contentLength, isExact: true };

  return { bytes: estimateBodySize(payload.body), isExact: false };
};

/**
 * Accumulates what a query does, for the devtools panel. Only ever created while
 * {@link provideQueryDevtools} is installed - measuring a body's size serializes it, which no app
 * without devtools should pay for.
 * @internal
 */
export const createQueryDevtoolsStats = (): QueryDevtoolsStatsRecorder => {
  const stats = signal(EMPTY_STATS);
  const runs = signal<readonly QueryDevtoolsRun[]>([]);

  // The baseline the next response's duration is measured against. Deliberately not part of the stats:
  // a duration is only ever reported once the response it belongs to has arrived.
  let lastExecutionAt: number | null = null;

  // The URL of the last execution, whether or not it requested - so a response that arrives without a run
  // of the query's own is still attributed to the URL the query was pointed at.
  let lastUrl: string | null = null;

  let runCounter = 0;

  const appendRun = (run: Omit<QueryDevtoolsRun, 'index'>, previous: readonly QueryDevtoolsRun[]) => {
    const appended: QueryDevtoolsRun = { ...run, index: ++runCounter };

    runs.set(trimRetainedResponses([...previous, appended].slice(-RUN_HISTORY)));
  };

  /**
   * Ends the newest run still in flight. A response with no run of the query's own waiting for it came
   * from elsewhere (see {@link QueryDevtoolsRun.didRequest}), so it is recorded as an instant instead.
   */
  const endRun = (end: {
    endedAt: number;
    status: 'success' | 'error';
    receivedBytes: number;
    response: unknown;
    hasResponse: boolean;
  }) => {
    const current = runs();
    const pending = lastPendingRunIndex(current);

    if (pending === -1) {
      appendRun(
        { ...end, startedAt: end.endedAt, didRequest: false, url: lastUrl, sentBytes: 0, attempts: 0 },
        current,
      );

      return;
    }

    runs.set(trimRetainedResponses(current.map((run, index) => (index === pending ? { ...run, ...end } : run))));
  };

  const recordExecution: QueryDevtoolsStatsRecorder['recordExecution'] = ({ didRequest, body, url }) => {
    const now = Date.now();
    const sent = didRequest ? measureQueryDevtoolsPayload({ body }) : null;

    lastExecutionAt = now;
    lastUrl = url ?? null;

    stats.update((current) => ({
      ...current,
      executions: current.executions + 1,
      requests: current.requests + (didRequest ? 1 : 0),
      sentBytes: current.sentBytes + (sent?.bytes ?? 0),
      hasEstimatedBytes: current.hasEstimatedBytes || (!!sent?.bytes && !sent.isExact),
      firstExecutedAt: current.firstExecutedAt ?? now,
    }));

    // An execution answered from the cache, or one that joined a request already in flight, starts no
    // run of its own - the response it eventually gets (if any) is what records one.
    if (!didRequest) return;

    appendRun(
      {
        startedAt: now,
        endedAt: null,
        status: 'pending',
        didRequest: true,
        url: lastUrl,
        attempts: 1,
        sentBytes: sent?.bytes ?? 0,
        receivedBytes: 0,
        response: null,
        hasResponse: false,
      },
      runs().map((run) => (run.status === 'pending' ? { ...run, status: 'aborted', endedAt: now } : run)),
    );
  };

  const recordResponse = (payload: QueryDevtoolsPayload) => {
    const now = Date.now();
    const received = measureQueryDevtoolsPayload(payload);
    const duration = lastExecutionAt === null ? null : now - lastExecutionAt;

    stats.update((current) => ({
      ...current,
      responses: current.responses + 1,
      receivedBytes: current.receivedBytes + received.bytes,
      hasEstimatedBytes: current.hasEstimatedBytes || (received.bytes > 0 && !received.isExact),
      lastResponseAt: now,
      lastDurationMs: duration,
      totalDurationMs: current.totalDurationMs + (duration ?? 0),
      lastResponseWasFaulted: false,
    }));

    endRun({
      endedAt: now,
      status: 'success',
      receivedBytes: received.bytes,
      response: payload.body,
      hasResponse: true,
    });
  };

  const recordError: QueryDevtoolsStatsRecorder['recordError'] = (options) => {
    stats.update((current) => ({
      ...current,
      errors: current.errors + 1,
      lastResponseWasFaulted: options?.faulted ?? false,
    }));

    endRun({ endedAt: Date.now(), status: 'error', receivedBytes: 0, response: null, hasResponse: false });
  };

  const recordRetry: QueryDevtoolsStatsRecorder['recordRetry'] = ({ attempt }) => {
    const current = runs();
    const pending = lastPendingRunIndex(current);
    const run = current[pending];

    // Nothing in flight means the retry belongs to a request this query is not the one waiting on, and an
    // attempt already accounted for is the caller reporting the same one twice.
    if (!run || attempt <= run.attempts) return;

    stats.update((state) => ({ ...state, retries: state.retries + (attempt - run.attempts) }));
    runs.set(current.map((entry, index) => (index === pending ? { ...entry, attempts: attempt } : entry)));
  };

  const reset = () => {
    lastExecutionAt = null;
    lastUrl = null;
    runCounter = 0;
    stats.set(EMPTY_STATS);
    runs.set([]);
  };

  return {
    current: stats.asReadonly(),
    runs: runs.asReadonly(),
    reset,
    recordExecution,
    recordResponse,
    recordError,
    recordRetry,
  };
};

/**
 * Adds up the stats of several entries, for a stack's or a client's total. `lastDurationMs` is taken from
 * whichever entry responded most recently rather than summed.
 */
export const sumQueryDevtoolsStats = (
  handles: readonly (QueryDevtoolsStatsHandle | undefined)[],
): QueryDevtoolsStats => {
  const total = { ...EMPTY_STATS };

  for (const handle of handles) {
    if (!handle) continue;

    const stats = handle.current();

    total.executions += stats.executions;
    total.requests += stats.requests;
    total.responses += stats.responses;
    total.errors += stats.errors;
    total.retries += stats.retries;
    total.receivedBytes += stats.receivedBytes;
    total.sentBytes += stats.sentBytes;
    total.totalDurationMs += stats.totalDurationMs;
    total.hasEstimatedBytes = total.hasEstimatedBytes || stats.hasEstimatedBytes;

    if (
      stats.firstExecutedAt !== null &&
      (total.firstExecutedAt === null || stats.firstExecutedAt < total.firstExecutedAt)
    ) {
      total.firstExecutedAt = stats.firstExecutedAt;
    }

    if (
      stats.lastResponseAt !== null &&
      (total.lastResponseAt === null || stats.lastResponseAt > total.lastResponseAt)
    ) {
      total.lastResponseAt = stats.lastResponseAt;
      total.lastDurationMs = stats.lastDurationMs;
    }
  }

  return total;
};
