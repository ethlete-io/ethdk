import { ActionClasses, actionClassOf } from '../agent-api/action-classes';
import { AgentApproval, AutoModeResolveRequest } from '../agent-api/approval-queue';
import { streamKeyLabel } from '../model/block';
import { EvidenceKind } from '../model/evidence';
import { storedSourceOf } from '../model/field-source';
import { StandIn } from '../model/stand-in';
import { maskIssueKey, maskNames, pseudonymMap } from '../reason/pseudonym';
import { DisputeCandidate, DisputeResolvingRequest } from '../ticket/dispute';
import { DEFAULT_MAX_TICKET_NOTES } from '../ticket/draft';
import { autoDescriptionRowId, quotableNotesOf } from './auto-description';
import { setRowIssue, setRowStandIn } from './edits';
import { AutoModeDispute, DayReviewEdits, DisputedTarget, ReviewedRow } from './model';

const BRANCH_EVIDENCE_KINDS: readonly EvidenceKind[] = [
  'branch',
  'inherited-branch',
  'branch-swap',
  'attribution-rule',
];

const MAX_BRANCH_LINES = 12;

/** The other answer a disputed row holds, or `undefined` for a row no two rungs disagree about. */
export const disputedTargetOf = (
  row: Pick<ReviewedRow, 'disputedIssueKey' | 'disputedStandInId'>,
): DisputedTarget | undefined => {
  if (row.disputedIssueKey) return { kind: 'issue', issueKey: row.disputedIssueKey };
  if (row.disputedStandInId) return { kind: 'stand-in', standInId: row.disputedStandInId };

  return undefined;
};

const sameTarget = (left: DisputedTarget, right: DisputedTarget) =>
  left.kind === 'issue'
    ? right.kind === 'issue' && right.issueKey === left.issueKey
    : right.kind === 'stand-in' && right.standInId === left.standInId;

/** What the approval queue keys a queued dispute answer by. */
export const autoModeResolveTarget = (day: string, rowId: string) => `${day}|dispute:${rowId}|apply`;

const touchedByUser = (edits: DayReviewEdits, id: string) => {
  if (edits.pinned.some((pin) => pin.id === id || pin.replaces.includes(id))) return true;

  const override = edits.overrides[id];

  if (!override) return false;
  if (override.state !== undefined || override.hidden !== undefined) return true;

  const named = override.issueKey !== undefined || override.standInId !== undefined;

  if (named && storedSourceOf({ set: true, source: override.sources?.issue }) !== 'auto') return true;

  return (
    override.description !== undefined &&
    storedSourceOf({ set: true, source: override.sources?.description }) !== 'auto'
  );
};

const disputeOf = (options: {
  disputes: readonly AutoModeDispute[];
  rowId: string;
  booked: string;
  other: DisputedTarget;
}) =>
  options.disputes.find(
    (held) => held.rowId === options.rowId && held.booked === options.booked && sameTarget(held.other, options.other),
  );

/**
 * The disputed rows of today auto mode still has to ask about: a row that books an issue, whose second
 * rung named other work, that the user left alone, and that holds no answer for this pair of answers.
 * Nothing on any day but today, nothing while auto mode is off, and nothing where `autoMode.apply` is
 * set to never.
 */
export const autoDisputeAsks = (options: {
  enabled: boolean;
  day: string;
  today: string;
  classes: ActionClasses;
  rows: readonly ReviewedRow[];
  edits: DayReviewEdits;
}): ReviewedRow[] => {
  if (!options.enabled || options.day !== options.today) return [];
  if (actionClassOf('autoMode.apply', options.classes) === 'human-only') return [];

  const disputes = options.edits.autoDisputes ?? [];
  const asked = new Set<string>();

  return options.rows.filter((row) => {
    const rowId = autoDescriptionRowId(row);
    const other = disputedTargetOf(row);

    if (!row.issueKey || !other || asked.has(rowId)) return false;
    if (row.hidden || row.unattended || row.excluded || row.state === 'rejected') return false;
    if (touchedByUser(options.edits, rowId)) return false;
    if (disputeOf({ disputes, rowId, booked: row.issueKey, other })) return false;

    asked.add(rowId);

    return true;
  });
};

const withoutPaths = (text: string) =>
  text.replace(
    /(^|[\s`])\/[^\s`]*/g,
    (match, lead: string) => `${lead}${match.slice(lead.length).split('/').filter(Boolean).at(-1) ?? ''}`,
  );

/**
 * The masked payload the dispute call is sent for a row: its checkout's name, its length and
 * description, both answers with the titles Jira gave them, its branch evidence with every path cut
 * to its folder's name, and the wording its quotable evidence carries.
 */
export const autoDisputeRequest = (options: {
  row: Pick<ReviewedRow, 'laneKey' | 'observedMs' | 'evidence' | 'issueKey' | 'description'>;
  other: DisputedTarget;
  /** Issue titles by key, where Jira could be read. */
  summaries?: Readonly<Record<string, string>>;
  standIns?: readonly Pick<StandIn, 'id' | 'name' | 'description'>[];
  maskedNames?: readonly string[];
}): DisputeResolvingRequest => {
  const { row, other } = options;
  const map = pseudonymMap(options.maskedNames ?? []);
  const mask = (text: string) => maskNames({ text, map });
  const issue = (key: string): DisputeCandidate => {
    const summary = options.summaries?.[key]?.trim();

    return { key: maskIssueKey({ issueKey: key, map }), ...(summary ? { summary: mask(summary) } : {}) };
  };
  const standIn = options.standIns?.find((entry) => other.kind === 'stand-in' && entry.id === other.standInId);
  const branches = [
    ...new Set(
      row.evidence
        .filter((entry) => BRANCH_EVIDENCE_KINDS.includes(entry.kind))
        .map((entry) => mask(withoutPaths(entry.detail))),
    ),
  ];
  const description = row.description.trim();

  return {
    ...(row.laneKey ? { repo: mask(streamKeyLabel(row.laneKey)) } : {}),
    minutes: Math.round(row.observedMs / 60_000),
    ...(description ? { description: mask(description) } : {}),
    booked: issue(row.issueKey ?? ''),
    other:
      other.kind === 'issue'
        ? issue(other.issueKey)
        : {
            standIn: mask(standIn?.name ?? 'work with no ticket yet'),
            ...(standIn?.description ? { description: mask(standIn.description) } : {}),
          },
    branches: branches.slice(0, MAX_BRANCH_LINES),
    notes: quotableNotesOf(row.evidence).slice(0, DEFAULT_MAX_TICKET_NOTES).map(mask),
  };
};

/** Stores what auto mode answered for a disputed row, replacing the answer the same row held. */
export const withAutoModeDispute = (edits: DayReviewEdits, dispute: AutoModeDispute): DayReviewEdits => ({
  ...edits,
  autoDisputes: [...(edits.autoDisputes ?? []).filter((held) => held.rowId !== dispute.rowId), dispute],
});

const chosenOf = (dispute: AutoModeDispute) => {
  const choice = dispute.answer?.choice;

  return choice === 'keep' || choice === 'use' ? choice : undefined;
};

/** The issue a keep or use answer chose, where Jira had it done when the answer came. Auto mode leaves that band. */
export const autoDisputeDoneChoice = (dispute: AutoModeDispute) => {
  const choice = chosenOf(dispute);
  const key =
    choice === 'keep'
      ? dispute.booked
      : choice === 'use' && dispute.other.kind === 'issue'
        ? dispute.other.issueKey
        : undefined;

  return key && dispute.doneKeys?.includes(key) ? key : undefined;
};

/**
 * The apply a keep or use answer queues where the user made `autoMode.apply` stricter than `local`,
 * and `null` for an unsure or failed answer or any other class.
 */
export const autoDisputeResolveRequest = (options: {
  day: string;
  dispute: AutoModeDispute;
  label: string;
  classes: ActionClasses;
}): AutoModeResolveRequest | null => {
  const { dispute } = options;
  const choice = chosenOf(dispute);

  if (!choice || autoDisputeDoneChoice(dispute) || actionClassOf('autoMode.apply', options.classes) !== 'external') {
    return null;
  }

  return {
    op: 'autoMode.resolve',
    day: options.day,
    rowId: dispute.rowId,
    label: options.label,
    booked: dispute.booked,
    other: dispute.other,
    choice,
    reason: dispute.answer?.reason ?? '',
  };
};

type ApprovalView = Pick<AgentApproval, 'id' | 'request' | 'target' | 'state' | 'result' | 'error'>;

const resolveApprovalOf = (options: { approvals: readonly ApprovalView[]; day: string; rowId: string }) => {
  const target = autoModeResolveTarget(options.day, options.rowId);

  return [...options.approvals]
    .reverse()
    .find((item) => item.target === target && item.request.op === 'autoMode.resolve');
};

/**
 * Whether auto mode may write a dispute answer now, by the rules a match follows: at `local`, at
 * `external` once its queued apply is approved, and never at `human-only`, after a rejected apply, for
 * an unsure answer, or for a choice Jira had done.
 */
export const autoDisputeApplies = (options: {
  day: string;
  dispute: AutoModeDispute;
  classes: ActionClasses;
  approvals: readonly ApprovalView[];
}) => {
  if (!chosenOf(options.dispute) || autoDisputeDoneChoice(options.dispute)) return false;

  const approval = resolveApprovalOf({ approvals: options.approvals, day: options.day, rowId: options.dispute.rowId });

  if (approval?.state === 'rejected') return false;

  const opClass = actionClassOf('autoMode.apply', options.classes);

  if (opClass === 'local') return true;
  if (opClass === 'human-only') return false;

  return approval?.state === 'approved' && approval.error === undefined;
};

/**
 * Writes each dispute answer that may be written now onto its row, stamped `auto`: a keep pins the key
 * the row books, a use names the row with the other answer. Only a row that still holds the same pair
 * of answers and that the user left alone is written. An `auto` name settles the dispute, and a reset
 * hands the band back.
 */
export const withAutoModeDisputeResolutions = (options: {
  edits: DayReviewEdits;
  rows: readonly ReviewedRow[];
  applies: (dispute: AutoModeDispute) => boolean;
}): DayReviewEdits => {
  const disputes = options.edits.autoDisputes ?? [];

  if (!disputes.length) return options.edits;

  return options.rows.reduce((edits, row) => {
    const rowId = autoDescriptionRowId(row);
    const other = disputedTargetOf(row);

    if (!row.issueKey || !other || touchedByUser(edits, rowId)) return edits;

    const dispute = disputeOf({ disputes, rowId, booked: row.issueKey, other });
    const choice = dispute ? chosenOf(dispute) : undefined;

    if (!dispute || !choice || !options.applies(dispute)) return edits;
    if (choice === 'keep') return setRowIssue({ edits, row, issueKey: row.issueKey, source: 'auto' });
    if (other.kind === 'issue') return setRowIssue({ edits, row, issueKey: other.issueKey, source: 'auto' });

    return setRowStandIn({ edits, row, standInId: other.standInId, source: 'auto' });
  }, options.edits);
};

/** Whether the edits hold the answer a dispute chose on its row, as auto mode wrote it. */
export const autoDisputeApplied = (edits: DayReviewEdits, dispute: AutoModeDispute) => {
  const override = edits.overrides[dispute.rowId];
  const choice = chosenOf(dispute);

  if (!override || !choice || override.sources?.issue !== 'auto') return false;
  if (choice === 'keep') return override.issueKey === dispute.booked && !override.standInId;

  return dispute.other.kind === 'issue'
    ? override.issueKey === dispute.other.issueKey && !override.standInId
    : override.standInId === dispute.other.standInId;
};

/**
 * Whether auto mode settled the dispute a row holds: the edits hold its answer for this row and this
 * pair of answers, and its name on the row. Any other `auto` name leaves the dispute on the band.
 */
export const autoDisputeSettles = (options: {
  edits: DayReviewEdits;
  row: Pick<ReviewedRow, 'id' | 'issueKey' | 'disputedIssueKey' | 'disputedStandInId'>;
}) => {
  const { edits, row } = options;
  const other = disputedTargetOf(row);

  if (!other || !row.issueKey || !edits.autoDisputes?.length) return false;

  const dispute = disputeOf({ disputes: edits.autoDisputes, rowId: row.id, booked: row.issueKey, other });

  return !!dispute && autoDisputeApplied(edits, dispute);
};

/** Whether the user named the row a dispute was asked for themselves. */
export const autoDisputeOverruled = (edits: DayReviewEdits, dispute: AutoModeDispute) => {
  const override = edits.overrides[dispute.rowId];
  const named = !!override && (override.issueKey !== undefined || override.standInId !== undefined);

  return named && storedSourceOf({ set: true, source: override.sources?.issue }) === 'human';
};
