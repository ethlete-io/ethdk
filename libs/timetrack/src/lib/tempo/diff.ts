import { SyncedWorklog, WorklogProposal, syncsInState } from '../model/proposal';
import { TempoMarkerScheme, unmarkedDescription } from './marker';
import { TempoWorklog } from './worklogs';

/** FNV-1a. Not a security hash — it only has to change when the synced content changes. */
const fnv1a = (value: string) => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
};

/**
 * Hashes everything a sync writes to Tempo, so an unchanged row can be skipped on the next sync.
 * Attribute values belong in the hash whenever the caller sends any — a changed billable flag is a
 * changed worklog even when the time and the text are identical.
 */
export const contentHashOf = (options: {
  proposal: WorklogProposal;
  attributes?: Record<string, string | number | boolean>;
}) => {
  const { proposal } = options;
  const attributes = Object.entries(options.attributes ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(',');

  return fnv1a(
    [proposal.issueKey, proposal.from.toISOString(), proposal.durationMs, proposal.description, attributes].join(
      '\u0000',
    ),
  );
};

export type TempoSyncCreateReason = 'new' | 'recreated-after-remote-delete' | 'recreated-after-issue-change';
export type TempoSyncUpdateReason = 'content-changed' | 'changed-in-tempo';
export type TempoSyncDeleteReason = 'proposal-removed' | 'proposal-rejected' | 'no-time-left' | 'issue-changed';

export type TempoSyncCreate = {
  proposal: WorklogProposal;
  issueId: string;
  contentHash: string;
  reason: TempoSyncCreateReason;
};

export type TempoSyncUpdate = {
  proposal: WorklogProposal;
  issueId: string;
  tempoWorklogId: string;
  contentHash: string;
  reason: TempoSyncUpdateReason;
};

export type TempoSyncDelete = {
  proposalId: string;
  tempoWorklogId: string;
  reason: TempoSyncDeleteReason;
};

export type TempoSyncPlan = {
  creates: TempoSyncCreate[];
  updates: TempoSyncUpdate[];
  deletes: TempoSyncDelete[];
  /** Proposal ids Tempo already holds exactly. */
  unchanged: string[];
  /** Proposals still awaiting review. A sync leaves them, and anything already synced for them, alone. */
  skipped: string[];
  /** Proposals whose issue key resolved to no Jira id. Tempo cannot be written without one. */
  unresolved: WorklogProposal[];
  /** Ledger entries whose Tempo worklog is gone and which have nothing left to write. Prune them. */
  staleLedgerProposalIds: string[];
  /** Worklogs in Tempo this app does not own. Reported for the preview; never written or deleted. */
  foreign: TempoWorklog[];
};

/**
 * Works out the create/update/delete set a sync would apply, for the preview the user confirms before
 * anything is written.
 *
 * Ownership comes from the ledger and nothing else: a worklog in Tempo that no ledger entry points at
 * is foreign, and stays untouched however much it looks like something this app would have written.
 * That is the rule that makes the app safe to run against a Tempo instance people also use by hand.
 *
 * Pass the same `marker` the sync writes with: a description-suffix marker is part of the remote text
 * and not of the proposal's, so without it every synced worklog reads as edited in Tempo forever.
 */
export const planTempoSync = (options: {
  proposals: WorklogProposal[];
  ledger: SyncedWorklog[];
  remote: TempoWorklog[];
  issueIdsByKey: Map<string, string>;
  attributesByProposalId?: Record<string, Record<string, string | number | boolean>>;
  marker?: TempoMarkerScheme;
}): TempoSyncPlan => {
  const ledgerByProposalId = new Map(options.ledger.map((entry) => [entry.proposalId, entry]));
  const remoteById = new Map(options.remote.map((worklog) => [worklog.id, worklog]));
  const ownedRemoteIds = new Set(
    options.ledger.map((entry) => entry.tempoWorklogId).filter((id) => remoteById.has(id)),
  );

  const plan: TempoSyncPlan = {
    creates: [],
    updates: [],
    deletes: [],
    unchanged: [],
    skipped: [],
    unresolved: [],
    staleLedgerProposalIds: [],
    foreign: options.remote.filter((worklog) => !ownedRemoteIds.has(worklog.id)),
  };

  const seenProposalIds = new Set<string>();

  for (const proposal of options.proposals) {
    seenProposalIds.add(proposal.id);

    const entry = ledgerByProposalId.get(proposal.id);
    const remote = entry ? remoteById.get(entry.tempoWorklogId) : undefined;

    if (!syncsInState(proposal.state)) {
      if (proposal.state === 'rejected' && entry && remote) {
        plan.deletes.push({
          proposalId: proposal.id,
          tempoWorklogId: entry.tempoWorklogId,
          reason: 'proposal-rejected',
        });
      } else if (proposal.state === 'rejected' && entry) {
        plan.staleLedgerProposalIds.push(proposal.id);
      } else {
        plan.skipped.push(proposal.id);
      }

      continue;
    }

    if (proposal.durationMs <= 0) {
      if (entry && remote) {
        plan.deletes.push({ proposalId: proposal.id, tempoWorklogId: entry.tempoWorklogId, reason: 'no-time-left' });
      } else if (entry) {
        plan.staleLedgerProposalIds.push(proposal.id);
      }

      continue;
    }

    const issueId = options.issueIdsByKey.get(proposal.issueKey);

    if (!issueId) {
      plan.unresolved.push(proposal);
      continue;
    }

    const contentHash = contentHashOf({
      proposal,
      attributes: options.attributesByProposalId?.[proposal.id],
    });

    if (!entry) {
      plan.creates.push({ proposal, issueId, contentHash, reason: 'new' });
      continue;
    }

    if (!remote) {
      plan.creates.push({ proposal, issueId, contentHash, reason: 'recreated-after-remote-delete' });
      continue;
    }

    if (remote.issueId !== issueId) {
      plan.deletes.push({ proposalId: proposal.id, tempoWorklogId: entry.tempoWorklogId, reason: 'issue-changed' });
      plan.creates.push({ proposal, issueId, contentHash, reason: 'recreated-after-issue-change' });
      continue;
    }

    if (entry.contentHash !== contentHash) {
      plan.updates.push({
        proposal,
        issueId,
        tempoWorklogId: entry.tempoWorklogId,
        contentHash,
        reason: 'content-changed',
      });
      continue;
    }

    const driftedInTempo =
      remote.durationMs !== proposal.durationMs ||
      unmarkedDescription({ worklog: remote, scheme: options.marker }) !== proposal.description;

    if (driftedInTempo) {
      plan.updates.push({
        proposal,
        issueId,
        tempoWorklogId: entry.tempoWorklogId,
        contentHash,
        reason: 'changed-in-tempo',
      });
      continue;
    }

    plan.unchanged.push(proposal.id);
  }

  for (const entry of options.ledger) {
    if (seenProposalIds.has(entry.proposalId)) continue;

    if (remoteById.has(entry.tempoWorklogId)) {
      plan.deletes.push({
        proposalId: entry.proposalId,
        tempoWorklogId: entry.tempoWorklogId,
        reason: 'proposal-removed',
      });
    } else {
      plan.staleLedgerProposalIds.push(entry.proposalId);
    }
  }

  return plan;
};
