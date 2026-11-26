import { WorklogProposal } from '../model/proposal';
import { fnv1a } from '../tempo/diff';
import { TempoSyncOutcome, TempoSyncRow } from '../tempo/execute';
import { TempoSyncPreview } from '../tempo/preview';
import {
  AgentApiTempoSyncPlan,
  AgentApiTempoSyncRowResult,
  AgentApiTempoSyncRun,
  AgentApiTempoSyncWrite,
} from './model';

const NEEDS_DESCRIPTION = 'needs a description, Tempo refuses an empty one';

const proposalWrite = (options: {
  kind: 'create' | 'update';
  proposal: WorklogProposal;
  reason: string;
  tempoWorklogId?: string;
}): AgentApiTempoSyncWrite => {
  const { proposal } = options;

  return {
    kind: options.kind,
    proposalId: proposal.id,
    issueKey: proposal.issueKey,
    fromMs: proposal.from.getTime(),
    durationMs: proposal.durationMs,
    description: proposal.description,
    reason: options.reason,
    ...(options.tempoWorklogId ? { tempoWorklogId: options.tempoWorklogId } : {}),
    ...(proposal.description.trim() ? {} : { blocked: NEEDS_DESCRIPTION }),
  };
};

/** A short hash of what a plan would send, stable across the order its writes are listed in. */
export const tempoSyncPlanHash = (writes: readonly AgentApiTempoSyncWrite[]) => {
  if (!writes.length) return '';

  const lines = writes
    .map((write) =>
      [
        write.kind,
        write.proposalId,
        write.issueKey ?? '',
        String(write.fromMs),
        String(write.durationMs),
        write.description,
        write.tempoWorklogId ?? '',
      ].join('\u0000'),
    )
    .sort();

  return fnv1a(lines.join('\u0001'));
};

/** The wire shape of a preview, with the hash a write has to name to be carried out. */
export const toAgentApiTempoSyncPlan = (options: { day: string; preview: TempoSyncPreview }): AgentApiTempoSyncPlan => {
  const { plan, remote, keysByIssueId } = options.preview;
  const remoteById = new Map(remote.map((worklog) => [worklog.id, worklog]));
  const writes: AgentApiTempoSyncWrite[] = [
    ...plan.deletes.map((entry): AgentApiTempoSyncWrite => {
      const worklog = remoteById.get(entry.tempoWorklogId);
      const issueKey = worklog ? keysByIssueId.get(worklog.issueId) : undefined;

      return {
        kind: 'delete',
        proposalId: entry.proposalId,
        ...(issueKey ? { issueKey } : {}),
        fromMs: worklog?.from.getTime() ?? 0,
        durationMs: worklog?.durationMs ?? 0,
        description: worklog?.description ?? '',
        reason: entry.reason,
        tempoWorklogId: entry.tempoWorklogId,
      };
    }),
    ...plan.creates.map((entry) => proposalWrite({ kind: 'create', proposal: entry.proposal, reason: entry.reason })),
    ...plan.updates.map((entry) =>
      proposalWrite({
        kind: 'update',
        proposal: entry.proposal,
        reason: entry.reason,
        tempoWorklogId: entry.tempoWorklogId,
      }),
    ),
  ];

  return {
    day: options.day,
    planHash: tempoSyncPlanHash(writes),
    writes,
    unchanged: plan.unchanged.length,
    skipped: plan.skipped.length,
    unresolvedKeys: [...new Set(plan.unresolved.map((proposal) => proposal.issueKey))],
    foreign: plan.foreign.map((worklog) => {
      const issueKey = keysByIssueId.get(worklog.issueId);

      return {
        id: worklog.id,
        ...(issueKey ? { issueKey } : {}),
        issueId: worklog.issueId,
        fromMs: worklog.from.getTime(),
        durationMs: worklog.durationMs,
        description: worklog.description,
      };
    }),
    coveredMs: plan.foreignSubtractions.reduce((sum, entry) => sum + entry.subtractedMs, 0),
  };
};

/** Why a write confirmed as `planHash` must not run against `plan`, or nothing where it may. */
export const tempoSyncWriteRefusal = (options: { plan: AgentApiTempoSyncPlan; planHash: string }) => {
  const { plan, planHash } = options;

  if (!plan.writes.length) return `${plan.day} has nothing to write to Tempo, so nothing was written.`;

  if (plan.planHash !== planHash) {
    return `The plan for ${plan.day} is ${plan.planHash} now, not ${planHash}, so nothing was written. Read it again, confirm its rows, and write with the new hash.`;
  }

  return null;
};

const detailOf = (row: TempoSyncRow) => {
  if (row.status === 'written') return undefined;

  if (row.status === 'blocked') {
    const needs = [
      ...(row.missingDescription ? ['a description'] : []),
      ...(row.missing ?? []).map((attribute) => attribute.name),
    ];

    return `needs ${needs.join(', ')}`;
  }

  return row.error?.message ?? 'did not land';
};

/** The wire shape of a finished run, each row named by the issue its plan wrote. */
export const toAgentApiTempoSyncRun = (options: {
  plan: AgentApiTempoSyncPlan;
  outcome: TempoSyncOutcome;
  unrecorded: string | null;
}): AgentApiTempoSyncRun => {
  const { outcome } = options;
  const issueKeys = new Map(options.plan.writes.map((write) => [`${write.kind}:${write.proposalId}`, write.issueKey]));
  const retry = outcome.retry;

  return {
    rows: outcome.rows.map((row): AgentApiTempoSyncRowResult => {
      const issueKey = issueKeys.get(`${row.kind}:${row.proposalId}`);
      const detail = detailOf(row);

      return {
        kind: row.kind,
        proposalId: row.proposalId,
        status: row.status,
        ...(issueKey ? { issueKey } : {}),
        ...(row.tempoWorklogId ? { tempoWorklogId: row.tempoWorklogId } : {}),
        ...(detail ? { detail } : {}),
      };
    }),
    retryCount: retry.creates.length + retry.updates.length + retry.deletes.length,
    ...(options.unrecorded ? { unrecorded: options.unrecorded } : {}),
  };
};
