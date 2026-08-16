import { CollectedEvent, EditorHeartbeatEvent } from '../model/event';
import { IngestedRecord } from './model';

/**
 * How far ahead of this machine's clock a reporter may date an observation. It covers jitter between
 * two clocks on the same machine and nothing more: a heartbeat in the future would open a block in
 * the future, which no later evidence can close.
 */
export const DEFAULT_MAX_AHEAD_MS = 2 * 60_000;

/**
 * How far back a reporter may date one. A reporter holds what it could not deliver while the app was
 * closed, so this has to cover a restart — but not a machine that was off for a week, where the
 * heartbeats describe a day the user has already reviewed.
 */
export const DEFAULT_MAX_BEHIND_MS = 24 * 60 * 60_000;

export type IngestParseOptions = {
  records: IngestedRecord[];
  /** This machine's clock, which is the one every other collector's timestamps come from. */
  now: Date;
  maxAheadMs?: number;
  maxBehindMs?: number;
};

/** Why a record produced no event. Shown as a count per reason, never with the record in it. */
export type IngestRejection = 'unknown-kind' | 'bad-timestamp' | 'malformed';

export type IngestParseResult = {
  events: CollectedEvent[];
  /** How many records each reason refused, for the source row to report a reporter that is broken. */
  rejected: Record<IngestRejection, number>;
};

const text = (payload: Record<string, unknown>, field: string) => {
  const value = payload[field];

  return typeof value === 'string' && value.trim() ? value : undefined;
};

const heartbeatOf = (record: IngestedRecord, at: Date): EditorHeartbeatEvent | null => {
  const repoPath = text(record.payload, 'repoPath');
  const directory = text(record.payload, 'directory');

  if (!repoPath && !directory) return null;

  return {
    at,
    source: 'editor',
    kind: 'editor-heartbeat',
    reporter: record.reporter,
    repoPath,
    branch: text(record.payload, 'branch'),
    directory,
    language: text(record.payload, 'language'),
    editing: record.payload['editing'] === true,
  };
};

/**
 * Turns what a reporter posted into events the store accepts, and counts what it refused.
 *
 * This is the only place a posted record is interpreted. The app's host buffers records without
 * looking inside them, so a reporter cannot reach the database with a shape nothing here knows: an
 * unknown `kind` is counted and dropped, which is also what makes an older app tolerate a reporter
 * that has learned to send something new.
 */
export const parseIngestedRecords = (options: IngestParseOptions): IngestParseResult => {
  const maxAheadMs = options.maxAheadMs ?? DEFAULT_MAX_AHEAD_MS;
  const maxBehindMs = options.maxBehindMs ?? DEFAULT_MAX_BEHIND_MS;
  const nowMs = options.now.getTime();
  const result: IngestParseResult = {
    events: [],
    rejected: { 'unknown-kind': 0, 'bad-timestamp': 0, malformed: 0 },
  };

  for (const record of options.records) {
    if (!Number.isFinite(record.atMs) || record.atMs > nowMs + maxAheadMs || record.atMs < nowMs - maxBehindMs) {
      result.rejected['bad-timestamp'] += 1;
      continue;
    }

    if (record.kind !== 'editor-heartbeat') {
      result.rejected['unknown-kind'] += 1;
      continue;
    }

    const event = heartbeatOf(record, new Date(record.atMs));

    if (!event) {
      result.rejected.malformed += 1;
      continue;
    }

    result.events.push(event);
  }

  return result;
};

/** How many records a parse refused, for a reporter that is posting something nothing understands. */
export const rejectedCount = (rejected: IngestParseResult['rejected']) =>
  Object.values(rejected).reduce((total, count) => total + count, 0);
