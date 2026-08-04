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
};

const EMPTY_STATS: QueryDevtoolsStats = {
  executions: 0,
  requests: 0,
  responses: 0,
  errors: 0,
  receivedBytes: 0,
  sentBytes: 0,
  hasEstimatedBytes: false,
  firstExecutedAt: null,
  lastResponseAt: null,
  lastDurationMs: null,
  totalDurationMs: 0,
};

/** A payload whose transferred size is to be measured, plus the headers it came with (if any). */
export type QueryDevtoolsPayload = {
  headers?: HttpHeaders | null;
  body: unknown;
};

/** The read side of a stats recorder, as a {@link QueryDevtoolsEntry} exposes it to the panel. */
export type QueryDevtoolsStatsHandle = {
  /** The live stats. */
  current: Signal<QueryDevtoolsStats>;

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
  }) => void;

  recordResponse: (payload: QueryDevtoolsPayload) => void;

  recordError: () => void;
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

/**
 * The size of a payload in bytes, and whether that size is the one that went over the wire. Only a
 * `content-length` header is exact; everything else is measured by serializing the body.
 * @internal
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

  // The baseline the next response's duration is measured against. Deliberately not part of the stats:
  // a duration is only ever reported once the response it belongs to has arrived.
  let lastExecutionAt: number | null = null;

  const recordExecution: QueryDevtoolsStatsRecorder['recordExecution'] = ({ didRequest, body }) => {
    const now = Date.now();
    const sent = didRequest ? measureQueryDevtoolsPayload({ body }) : null;

    lastExecutionAt = now;

    stats.update((current) => ({
      ...current,
      executions: current.executions + 1,
      requests: current.requests + (didRequest ? 1 : 0),
      sentBytes: current.sentBytes + (sent?.bytes ?? 0),
      hasEstimatedBytes: current.hasEstimatedBytes || (!!sent?.bytes && !sent.isExact),
      firstExecutedAt: current.firstExecutedAt ?? now,
    }));
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
    }));
  };

  const recordError = () => stats.update((current) => ({ ...current, errors: current.errors + 1 }));

  const reset = () => {
    lastExecutionAt = null;
    stats.set(EMPTY_STATS);
  };

  return { current: stats.asReadonly(), reset, recordExecution, recordResponse, recordError };
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
