import { Observable, catchError, concatMap, from, map, of, toArray } from 'rxjs';
import { SyncedWorklog, WorklogProposal } from '../model/proposal';
import { localDayKey } from '../review/day';
import { TimetrackTransport } from '../transport/ports';
import { TempoWorkAttribute, missingRequiredAttributes } from './attributes';
import { TempoCredentials, TempoRequestError } from './client';
import { TempoSyncCreate, TempoSyncDelete, TempoSyncPlan, TempoSyncUpdate } from './diff';
import { TempoMarkerScheme, applyWorklogMarker } from './marker';
import { createTempoWorklog$, deleteTempoWorklog$, updateTempoWorklog$ } from './write';

export type TempoSyncRowKind = 'create' | 'update' | 'delete';

/**
 * `blocked` is a row the instance's schema refuses (a required attribute has no value) and `skipped`
 * one whose prerequisite did not land. Neither was sent, and both are retried like a failure once the
 * reviewer supplies what is missing.
 */
export type TempoSyncRowStatus = 'written' | 'blocked' | 'skipped' | 'failed';

export type TempoSyncRow = {
  kind: TempoSyncRowKind;
  proposalId: string;
  status: TempoSyncRowStatus;
  tempoWorklogId?: string;
  /** The required attributes a `blocked` row is waiting for. */
  missing?: TempoWorkAttribute[];
  error?: Error;
};

export type TempoSyncOutcome = {
  /** One row per write the plan asked for, in the order they were attempted. */
  rows: TempoSyncRow[];
  /** Ledger entries to store, keyed by `proposalId`. */
  ledger: SyncedWorklog[];
  /** Ledger entries to drop: worklogs this sync deleted, plus the plan's stale entries. */
  prunedProposalIds: string[];
  /** The writes that did not land, as a plan this function can be handed again to retry them. */
  retry: TempoSyncPlan;
};

export type TempoSyncOptions = {
  transport: TimetrackTransport;
  credentials: TempoCredentials;
  plan: TempoSyncPlan;
  /** The Jira account id the worklogs are logged for. */
  authorAccountId: string;
  /** The instance's schema, so a required attribute is reported rather than guessed. */
  workAttributes?: TempoWorkAttribute[];
  attributesByProposalId?: Record<string, Record<string, string | number | boolean>>;
  marker?: TempoMarkerScheme;
  syncedAt?: Date;
};

type ExecutedRow = {
  row: TempoSyncRow;
  ledger?: SyncedWorklog;
};

const asError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

const failedRow = (row: { kind: TempoSyncRowKind; proposalId: string; error: unknown }): ExecutedRow => ({
  row: { kind: row.kind, proposalId: row.proposalId, status: 'failed', error: asError(row.error) },
});

const valuesFor = (options: TempoSyncOptions, proposal: WorklogProposal) =>
  applyWorklogMarker({
    description: proposal.description,
    proposalId: proposal.id,
    scheme: options.marker,
    attributes: options.attributesByProposalId?.[proposal.id],
  });

const deleteStep$ = (options: TempoSyncOptions, entry: TempoSyncDelete): Observable<ExecutedRow> => {
  const row = (status: TempoSyncRowStatus, error?: Error): ExecutedRow => ({
    row: {
      kind: 'delete',
      proposalId: entry.proposalId,
      status,
      tempoWorklogId: entry.tempoWorklogId,
      ...(error ? { error } : {}),
    },
  });

  return deleteTempoWorklog$({
    transport: options.transport,
    credentials: options.credentials,
    tempoWorklogId: entry.tempoWorklogId,
  }).pipe(
    map(() => row('written')),
    catchError((error: unknown) =>
      // A worklog that is already gone is what the delete was for, so a 404 is a success, not a retry.
      of(error instanceof TempoRequestError && error.status === 404 ? row('written') : row('failed', asError(error))),
    ),
  );
};

/** The deletes that did not land, so a create replacing one of them is never sent. */
type CreateContext = { options: TempoSyncOptions; failedDeletes: Set<string> };

const createStep$ = (context: CreateContext, entry: TempoSyncCreate): Observable<ExecutedRow> => {
  const { options } = context;
  const proposalId = entry.proposal.id;

  if (context.failedDeletes.has(proposalId)) {
    return of<ExecutedRow>({
      row: {
        kind: 'create',
        proposalId,
        status: 'skipped',
        error: new Error(
          'Not created: deleting the worklog it replaces failed, and writing both would log the time twice.',
        ),
      },
    });
  }

  const { description, attributes } = valuesFor(options, entry.proposal);
  const missing = missingRequiredAttributes({ attributes: options.workAttributes ?? [], values: attributes });

  if (missing.length > 0) return of<ExecutedRow>({ row: { kind: 'create', proposalId, status: 'blocked', missing } });

  return createTempoWorklog$({
    transport: options.transport,
    credentials: options.credentials,
    write: {
      authorAccountId: options.authorAccountId,
      issueId: entry.issueId,
      from: entry.proposal.from,
      durationMs: entry.proposal.durationMs,
      description,
      attributes,
    },
  }).pipe(
    map((tempoWorklogId): ExecutedRow => ({
      row: { kind: 'create', proposalId, status: 'written', tempoWorklogId },
      ledger: {
        proposalId,
        day: localDayKey(entry.proposal.from),
        tempoWorklogId,
        contentHash: entry.contentHash,
        syncedAt: options.syncedAt ?? new Date(),
      },
    })),
    catchError((error: unknown) => of(failedRow({ kind: 'create', proposalId, error }))),
  );
};

const updateStep$ = (options: TempoSyncOptions, entry: TempoSyncUpdate): Observable<ExecutedRow> => {
  const proposalId = entry.proposal.id;
  const { description, attributes } = valuesFor(options, entry.proposal);
  const missing = missingRequiredAttributes({ attributes: options.workAttributes ?? [], values: attributes });

  if (missing.length > 0) {
    return of<ExecutedRow>({
      row: { kind: 'update', proposalId, status: 'blocked', tempoWorklogId: entry.tempoWorklogId, missing },
    });
  }

  return updateTempoWorklog$({
    transport: options.transport,
    credentials: options.credentials,
    tempoWorklogId: entry.tempoWorklogId,
    write: {
      authorAccountId: options.authorAccountId,
      issueId: entry.issueId,
      from: entry.proposal.from,
      durationMs: entry.proposal.durationMs,
      description,
      attributes,
    },
  }).pipe(
    map((): ExecutedRow => ({
      row: { kind: 'update', proposalId, status: 'written', tempoWorklogId: entry.tempoWorklogId },
      ledger: {
        proposalId,
        day: localDayKey(entry.proposal.from),
        tempoWorklogId: entry.tempoWorklogId,
        contentHash: entry.contentHash,
        syncedAt: options.syncedAt ?? new Date(),
      },
    })),
    catchError((error: unknown) => of(failedRow({ kind: 'update', proposalId, error }))),
  );
};

const runInOrder$ = (steps: Observable<ExecutedRow>[]) =>
  steps.length === 0
    ? of<ExecutedRow[]>([])
    : from(steps).pipe(
        concatMap((step) => step),
        toArray(),
      );

const landed = (executed: ExecutedRow) => executed.row.status === 'written';

const retryOf = (plan: TempoSyncPlan, executed: ExecutedRow[]): TempoSyncPlan => {
  const unfinished = new Set(executed.filter((entry) => !landed(entry)).map((entry) => entry.row));
  const unfinishedIds = (kind: TempoSyncRowKind) =>
    new Set([...unfinished].filter((row) => row.kind === kind).map((row) => row.proposalId));
  const creates = unfinishedIds('create');
  const updates = unfinishedIds('update');
  const deletes = new Set(
    [...unfinished].filter((row) => row.kind === 'delete').map((row) => `${row.proposalId} ${row.tempoWorklogId}`),
  );

  return {
    creates: plan.creates.filter((entry) => creates.has(entry.proposal.id)),
    updates: plan.updates.filter((entry) => updates.has(entry.proposal.id)),
    deletes: plan.deletes.filter((entry) => deletes.has(`${entry.proposalId} ${entry.tempoWorklogId}`)),
    unchanged: [],
    skipped: [],
    unresolved: [],
    staleLedgerProposalIds: [],
    foreign: [],
  };
};

const outcomeOf = (plan: TempoSyncPlan, executed: ExecutedRow[]): TempoSyncOutcome => {
  const ledger = executed.flatMap((entry) => entry.ledger ?? []);
  const owning = new Set(ledger.map((entry) => entry.proposalId));
  const deleted = executed
    .filter((entry) => entry.row.kind === 'delete' && landed(entry))
    .map((entry) => entry.row.proposalId);

  return {
    rows: executed.map((entry) => entry.row),
    ledger,
    prunedProposalIds: [...new Set([...deleted, ...plan.staleLedgerProposalIds])].filter((id) => !owning.has(id)),
    retry: retryOf(plan, executed),
  };
};

/**
 * Applies a {@link TempoSyncPlan}: the second phase of a sync, run once the user has confirmed the
 * preview. Only worklogs the plan owns are touched — `foreign`, `skipped`, `unchanged` and
 * `unresolved` are read out of the plan by the UI and never written here.
 *
 * Writes are serialized, and every delete runs before any create: a proposal whose issue changed is a
 * delete plus a create, and doing it the other way round would leave the same hour logged on two
 * issues if the delete then failed. A create whose delete did not land is reported `skipped` rather
 * than sent. One row failing never stops the rest — each is reported on its own, and `retry` is the
 * subset that did not land, shaped as a plan this function accepts.
 *
 * Apply `ledger` as upserts and `prunedProposalIds` as removals in either order: a proposal that ends
 * up owning a worklog never appears in both.
 */
export const executeTempoSync$ = (options: TempoSyncOptions): Observable<TempoSyncOutcome> =>
  runInOrder$(options.plan.deletes.map((entry) => deleteStep$(options, entry))).pipe(
    concatMap((deleted) => {
      const failedDeletes = new Set(deleted.filter((entry) => !landed(entry)).map((entry) => entry.row.proposalId));
      const writes = [
        ...options.plan.creates.map((entry) => createStep$({ options, failedDeletes }, entry)),
        ...options.plan.updates.map((entry) => updateStep$(options, entry)),
      ];

      return runInOrder$(writes).pipe(map((written) => outcomeOf(options.plan, [...deleted, ...written])));
    }),
  );
