import { ActionClasses, actionClassOf } from '../agent-api/action-classes';
import { AgentApproval, AgentApprovalRequest, AutoModeApplyRequest } from '../agent-api/approval-queue';
import { AgentApiRequest } from '../agent-api/model';
import { UnnamedContext } from '../model/attribution';
import { contextKey, dominantContext, streamKeyLabel } from '../model/block';
import { RowFieldSources, mayAutoWrite, rowFieldSourceOf } from '../model/field-source';
import { StandIn, standInResolutionSourceOf } from '../model/stand-in';
import { WorkGroup } from '../rows/merge';
import { unnamedRowId } from '../rows/propose';
import { setRowIssue } from './edits';
import { WorklogWritingRequest } from '../ticket/worklog';
import { TicketWritingRequest } from '../ticket/write';
import { autoDescriptionRowId, storedDescriptionSource } from './auto-description';
import { AutoModeAnswer, AutoModeSubject, DayReviewEdits, ReviewedRow } from './model';

export const autoModeSubjectKey = (subject: AutoModeSubject) =>
  subject.kind === 'context' ? `context:${subject.contextId}` : `stand-in:${subject.standInId}`;

/** What the approval queue keys an auto-mode create by, so a second ask for the same subject reuses it. */
export const autoModeApprovalTarget = (day: string, subject: AutoModeSubject) =>
  `${day}|${autoModeSubjectKey(subject)}`;

/** What the queue keys a queued apply by. It differs from the create's, which a subject may also hold. */
export const autoModeApplyTarget = (day: string, subject: AutoModeSubject) =>
  `${autoModeApprovalTarget(day, subject)}|apply`;

const subjectOfTarget = (target: string | undefined, day: string): AutoModeSubject | null => {
  const key = target?.startsWith(`${day}|`) ? target.slice(day.length + 1) : null;

  if (key?.startsWith('stand-in:')) return { kind: 'stand-in', standInId: key.slice('stand-in:'.length) };
  if (key?.startsWith('context:')) return { kind: 'context', contextId: key.slice('context:'.length) };

  return null;
};

const subjectRowIds = (options: {
  subject: AutoModeSubject;
  rows: readonly ReviewedRow[];
  unattributed: readonly WorkGroup[];
}) => {
  const { subject, rows } = options;

  if (subject.kind === 'stand-in') {
    return rows.filter((row) => row.standInId === subject.standInId).map((row) => row.id);
  }

  const ids = new Set(
    options.unattributed.flatMap((group) => {
      const context = dominantContext(group.blocks);

      return context && contextKey(context) === subject.contextId ? [unnamedRowId(group)] : [];
    }),
  );

  return rows.filter((row) => ids.has(row.id) || ids.has(row.recutOf ?? '')).map((row) => row.id);
};

/**
 * The rows of a day a waiting approval previews on: the band an auto mode create, apply or hide is for, or
 * the row a `worklog.add` falls on. Empty when the item has no band on that day.
 */
export const approvalRowIdsOf = (options: {
  item: Pick<AgentApproval, 'request' | 'target'>;
  day: string;
  rows: readonly ReviewedRow[];
  /** The day's unattributed groups, which say which context each unnamed row came from. */
  unattributed: readonly WorkGroup[];
}): string[] => {
  const { item, day, rows } = options;
  const { request } = item;

  if (request.op === 'autoMode.apply') {
    return request.day === day
      ? subjectRowIds({ subject: request.subject, rows, unattributed: options.unattributed })
      : [];
  }

  if (request.op === 'autoMode.hide') {
    return request.day === day && rows.some((row) => row.id === request.rowId) ? [request.rowId] : [];
  }

  if (request.op === 'jira.create') {
    const subject = subjectOfTarget(item.target, day);

    return subject ? subjectRowIds({ subject, rows, unattributed: options.unattributed }) : [];
  }

  if (request.op === 'worklog.add') {
    const from = request.fromMs;
    const to = from + request.durationMs;
    const overlapping = rows.filter((row) => row.from.getTime() < to && row.to.getTime() > from);
    const row = overlapping.find((entry) => entry.issueKey === request.issueKey) ?? overlapping[0];

    return row ? [row.id] : [];
  }

  return [];
};

const answeredKeys = (answers: readonly AutoModeAnswer[]) =>
  new Set(answers.map((answer) => autoModeSubjectKey(answer.subject)));

/**
 * What auto mode still has to ask about on a day: each unnamed context and each open stand-in the day
 * holds that holds no answer yet. Nothing on any day but today, and nothing while auto mode is off.
 * A stand-in the user reopened is theirs, so it is left alone until a reset hands it back, and so is
 * one whose row the user gave a ticket by hand today.
 */
export const autoModeAsks = (options: {
  enabled: boolean;
  day: string;
  today: string;
  contexts: readonly UnnamedContext[];
  /** The contexts a standing rule already answers, which the day still lists but never asks about. */
  ruledContextIds?: ReadonlySet<string>;
  standIns: readonly Pick<StandIn, 'id' | 'state' | 'days' | 'resolutionSource'>[];
  rows: readonly Pick<ReviewedRow, 'standInId' | 'issueKey' | 'sources'>[];
  answers: readonly AutoModeAnswer[];
}): AutoModeSubject[] => {
  if (!options.enabled || options.day !== options.today) return [];

  const answered = answeredKeys(options.answers);
  const keyedByHand = new Set(
    options.rows
      .filter((row) => row.standInId && row.issueKey && rowFieldSourceOf(row, 'issue') === 'human')
      .map((row) => row.standInId),
  );
  const contexts = options.contexts
    .filter((context) => !options.ruledContextIds?.has(context.id))
    .map((context): AutoModeSubject => ({ kind: 'context', contextId: context.id }));
  const standIns = options.standIns
    .filter(
      (standIn) =>
        standIn.state === 'open' &&
        standIn.days.includes(options.day) &&
        !keyedByHand.has(standIn.id) &&
        mayAutoWrite(standInResolutionSourceOf(standIn)),
    )
    .map((standIn): AutoModeSubject => ({ kind: 'stand-in', standInId: standIn.id }));

  return [...contexts, ...standIns].filter((subject) => !answered.has(autoModeSubjectKey(subject)));
};

/** The issue an answer names: the one the match found, or the one its approved create filed. */
export const autoModeIssueKeyOf = (answer: AutoModeAnswer) => {
  const { outcome } = answer;

  if (outcome.kind === 'match') return outcome.issueKey;

  return outcome.kind === 'draft' ? outcome.createdKey : undefined;
};

/** Stores an answer, replacing the one the same subject held. */
export const withAutoModeAnswer = (edits: DayReviewEdits, answer: AutoModeAnswer): DayReviewEdits => {
  const key = autoModeSubjectKey(answer.subject);

  return {
    ...edits,
    auto: [...(edits.auto ?? []).filter((held) => autoModeSubjectKey(held.subject) !== key), answer],
  };
};

/** Records the issue the approved create of a draft filed. An unknown approval changes nothing. */
export const withAutoModeCreated = (
  edits: DayReviewEdits,
  options: { approvalId: string; issueKey: string },
): DayReviewEdits => {
  const answers = edits.auto ?? [];
  const found = answers.some(
    (answer) => answer.outcome.kind === 'draft' && answer.outcome.approvalId === options.approvalId,
  );

  if (!found) return edits;

  return {
    ...edits,
    auto: answers.map((answer) =>
      answer.outcome.kind === 'draft' && answer.outcome.approvalId === options.approvalId
        ? { ...answer, outcome: { ...answer.outcome, createdKey: options.issueKey } }
        : answer,
    ),
  };
};

/**
 * The create a draft queues. `null` for any other answer, and for a draft already queued or filed:
 * each band is asked once, and a second create would file the ticket twice.
 */
export const autoModeCreateRequest = (
  answer: AutoModeAnswer,
): Extract<AgentApiRequest, { op: 'jira.create' }> | null => {
  const { outcome } = answer;

  if (outcome.kind !== 'draft' || outcome.approvalId || outcome.createdKey) return null;

  return {
    op: 'jira.create',
    summary: outcome.summary,
    description: outcome.description,
    ...(outcome.projectKey ? { projectKey: outcome.projectKey } : {}),
    ...(outcome.parentKey ? { parentKey: outcome.parentKey } : {}),
  };
};

/**
 * A draft answer pointed at the queued create that files it. The draft takes that create's wording,
 * which differs from its own where an earlier ask for the same subject queued it.
 */
export const autoModeQueuedAnswer = (
  answer: AutoModeAnswer,
  approval: { id: string; request: AgentApprovalRequest },
): AutoModeAnswer => {
  const { outcome } = answer;
  const { request } = approval;

  if (outcome.kind !== 'draft') return answer;
  if (request.op !== 'jira.create') return { ...answer, outcome: { ...outcome, approvalId: approval.id } };

  return {
    ...answer,
    outcome: {
      kind: 'draft',
      summary: request.summary,
      description: request.description,
      ...(request.projectKey ? { projectKey: request.projectKey } : {}),
      ...(request.parentKey ? { parentKey: request.parentKey } : {}),
      approvalId: approval.id,
    },
  };
};

/**
 * Names the day's unnamed rows with the issue auto mode found for the context behind each one, stamped
 * `auto`. A row the user named or cleared keeps their answer, and a band nobody was at the machine for,
 * or one a rule says is not work, stays the user's to name.
 */
export const withAutoModeRowNames = (options: {
  edits: DayReviewEdits;
  rows: readonly ReviewedRow[];
  /** The day's unattributed groups, which say which context each unnamed row came from. */
  unattributed: readonly WorkGroup[];
  /** Which answers may be written now. See {@link autoModeApplies}. Absent, every one may. */
  applies?: (answer: AutoModeAnswer) => boolean;
}): DayReviewEdits => {
  const keys = new Map<string, string>();

  for (const answer of options.edits.auto ?? []) {
    if (options.applies && !options.applies(answer)) continue;

    const issueKey = autoModeIssueKeyOf(answer);

    if (answer.subject.kind === 'context' && issueKey) keys.set(answer.subject.contextId, issueKey);
  }

  if (!keys.size) return options.edits;

  const contextOfRow = new Map<string, string>();

  for (const group of options.unattributed) {
    const context = dominantContext(group.blocks);

    if (context) contextOfRow.set(unnamedRowId(group), contextKey(context));
  }

  return options.rows.reduce((edits, row) => {
    if (row.issueKey || row.standInId || row.hidden || row.unattended || row.excluded) return edits;
    if (rowFieldSourceOf(row, 'issue') !== 'observed') return edits;

    const contextId = contextOfRow.get(row.id);
    const issueKey = contextId ? keys.get(contextId) : undefined;

    return issueKey ? setRowIssue({ edits, row, issueKey, source: 'auto' }) : edits;
  }, options.edits);
};

/** The approved creates auto mode queued whose filed issue the day does not record yet. */
export const autoModeCreatedKeys = (options: {
  answers: readonly AutoModeAnswer[];
  approvals: readonly { id: string; state: string; result?: unknown }[];
}) =>
  options.answers.flatMap((answer) => {
    const { outcome } = answer;

    if (outcome.kind !== 'draft' || !outcome.approvalId || outcome.createdKey) return [];

    const approval = options.approvals.find((item) => item.id === outcome.approvalId);
    const issueKey = approval?.state === 'approved' ? createdIssueKeyOf(approval.result) : undefined;

    return issueKey ? [{ answer, approvalId: outcome.approvalId, issueKey }] : [];
  });

const createdIssueKeyOf = (result: unknown) => {
  const issue = typeof result === 'object' && result !== null ? (result as { issue?: unknown }).issue : undefined;
  const key = typeof issue === 'object' && issue !== null ? (issue as { key?: unknown }).key : undefined;

  return typeof key === 'string' && key ? key : undefined;
};

type ApprovalView = Pick<AgentApproval, 'id' | 'request' | 'target' | 'state' | 'result' | 'error'>;

const applyApprovalOf = (options: { approvals: readonly ApprovalView[]; day: string; subject: AutoModeSubject }) => {
  const target = autoModeApplyTarget(options.day, options.subject);

  return [...options.approvals]
    .reverse()
    .find((item) => item.target === target && item.request.op === 'autoMode.apply');
};

/**
 * The apply a match queues where the user made `autoMode.apply` stricter than `local`, and `null`
 * for any other answer or class.
 */
export const autoModeApplyRequest = (options: {
  day: string;
  answer: AutoModeAnswer;
  label: string;
  classes: ActionClasses;
}): AutoModeApplyRequest | null => {
  const { outcome, subject } = options.answer;

  if (outcome.kind !== 'match' || actionClassOf('autoMode.apply', options.classes) !== 'external') return null;

  return { op: 'autoMode.apply', day: options.day, subject, label: options.label, issueKey: outcome.issueKey };
};

/**
 * Whether auto mode may write what an answer found now. A match writes at `local`, at `external` once
 * its queued apply is approved, and never at `human-only` or after a rejected apply. The key an
 * approved create filed is written whatever the class.
 */
export const autoModeApplies = (options: {
  day: string;
  answer: AutoModeAnswer;
  classes: ActionClasses;
  approvals: readonly ApprovalView[];
}) => {
  const { outcome, subject } = options.answer;

  if (outcome.kind === 'draft') return !!outcome.createdKey;
  if (outcome.kind !== 'match') return false;

  const approval = applyApprovalOf({ approvals: options.approvals, day: options.day, subject });

  if (approval?.state === 'rejected') return false;

  const opClass = actionClassOf('autoMode.apply', options.classes);

  if (opClass === 'local') return true;
  if (opClass === 'human-only') return false;

  return approval?.state === 'approved' && approval.error === undefined;
};

/** A band's context id as a short name: the checkout's folder and branch, or the application. */
export const autoModeContextLabel = (contextId: string) => {
  if (contextId.startsWith('app:')) return contextId.slice('app:'.length) || 'an application';

  const match = /^repo:(.*?)(?:@([^#]*)(?:#(.*))?|~.*)$/.exec(contextId);

  if (!match) return contextId;

  const [, path = '', branch, workPath] = match;
  const folder = path.split('/').filter(Boolean).at(-1) ?? path;

  return [folder, branch, workPath].filter(Boolean).join(' · ');
};

export type AutoModeReadoutStatus =
  | 'applied'
  | 'approved'
  | 'waiting'
  | 'rejected'
  | 'expired'
  | 'filed'
  | 'held'
  | 'overruled'
  | 'unused'
  | 'not-queued'
  | 'written'
  | 'failed';

/** One thing auto mode asked about today, and what came of it, read from what the app stored. */
export type AutoModeReadoutEntry = {
  key: string;
  kind: AutoModeSubject['kind'] | 'description';
  label: string;
  askedAtMs: number;
  status: AutoModeReadoutStatus;
  issueKey?: string;
  /** The title of the ticket it drafted. */
  summary?: string;
  /** The rows of the day that carry `issueKey` as auto mode's naming. */
  namedRows: number;
  /** The worklog line it wrote for a row. */
  description?: string;
  error?: string;
  /** The masked payload that left the machine. */
  request: TicketWritingRequest | WorklogWritingRequest;
};

const autoNamedRows = (edits: DayReviewEdits, issueKey: string | undefined) => {
  if (!issueKey) return 0;

  const named = (row: { issueKey?: string; sources?: RowFieldSources }) =>
    row.issueKey === issueKey && row.sources?.issue === 'auto';

  return Object.values(edits.overrides).filter(named).length + edits.pinned.filter(named).length;
};

const approvalStatusFor = (approval: ApprovalView): AutoModeReadoutStatus | undefined => {
  if (approval.state === 'queued' || approval.state === 'running') return 'waiting';
  if (approval.state === 'rejected' || approval.state === 'expired') return approval.state;

  return approval.error === undefined ? undefined : 'failed';
};

const descriptionReadout = (options: {
  edits: DayReviewEdits;
  rows: readonly Pick<ReviewedRow, 'id' | 'recutOf' | 'laneKey' | 'issueKey'>[];
}): AutoModeReadoutEntry[] =>
  (options.edits.autoDescriptions ?? []).map((answer): AutoModeReadoutEntry => {
    const row = options.rows.find((entry) => autoDescriptionRowId(entry) === answer.rowId);
    const base = {
      key: `description:${answer.rowId}`,
      kind: 'description' as const,
      label: row?.laneKey ? streamKeyLabel(row.laneKey) : (answer.request.repo ?? 'a code row'),
      askedAtMs: answer.askedAtMs,
      namedRows: 0,
      request: answer.request,
      ...(row?.issueKey ? { issueKey: row.issueKey } : {}),
    };

    if (!answer.description) return { ...base, status: 'failed' };

    const status = storedDescriptionSource(options.edits, answer.rowId) === 'human' ? 'overruled' : 'written';

    return { ...base, status, description: answer.description };
  });

const ticketReadout = (options: {
  day: string;
  edits: DayReviewEdits;
  approvals: readonly ApprovalView[];
  classes: ActionClasses;
  standIns: readonly Pick<StandIn, 'id' | 'name' | 'state' | 'issueKey' | 'resolutionSource'>[];
}): AutoModeReadoutEntry[] =>
  (options.edits.auto ?? []).map((answer): AutoModeReadoutEntry => {
    const { subject, outcome } = answer;
    const standIn =
      subject.kind === 'stand-in' ? options.standIns.find((entry) => entry.id === subject.standInId) : undefined;
    const base = {
      key: autoModeSubjectKey(subject),
      kind: subject.kind,
      label:
        subject.kind === 'context' ? autoModeContextLabel(subject.contextId) : (standIn?.name ?? 'a deleted stand-in'),
      askedAtMs: answer.askedAtMs,
      request: answer.request,
    };

    if (outcome.kind === 'failed') return { ...base, status: 'failed', namedRows: 0 };

    if (outcome.kind === 'draft') {
      const approval = outcome.approvalId
        ? options.approvals.find((item) => item.id === outcome.approvalId)
        : undefined;
      const issueKey =
        outcome.createdKey ?? (approval?.state === 'approved' ? createdIssueKeyOf(approval.result) : undefined);
      const draft = { ...base, summary: outcome.summary, namedRows: autoNamedRows(options.edits, issueKey) };
      const waiting = approval ? approvalStatusFor(approval) : undefined;

      if (waiting) return { ...draft, status: waiting, ...(approval?.error ? { error: approval.error } : {}) };
      if (issueKey) return { ...draft, status: 'filed', issueKey };
      if (actionClassOf('autoMode.create', options.classes) === 'human-only') return { ...draft, status: 'held' };

      return { ...draft, status: 'not-queued' };
    }

    const { issueKey } = outcome;
    const found = { ...base, issueKey, namedRows: autoNamedRows(options.edits, issueKey) };
    const approval = applyApprovalOf({ approvals: options.approvals, day: options.day, subject });
    const applied =
      subject.kind === 'context'
        ? found.namedRows > 0
        : standIn?.state === 'resolved' && standIn.issueKey === issueKey && standIn.resolutionSource === 'auto';

    if (applied) return { ...found, status: 'applied' };
    if (standIn && standInResolutionSourceOf(standIn) === 'human') return { ...found, status: 'overruled' };

    if (approval) {
      const waiting = approvalStatusFor(approval);

      if (waiting) return { ...found, status: waiting, ...(approval.error ? { error: approval.error } : {}) };

      return { ...found, status: 'approved' };
    }

    if (actionClassOf('autoMode.apply', options.classes) === 'human-only') return { ...found, status: 'held' };

    return { ...found, status: 'unused' };
  });

/**
 * What auto mode did on a day, one entry per band or stand-in it asked about and per row it described,
 * oldest first. Every status is read from the stored answers, rows, stand-ins and queue, never from
 * what it meant to do.
 */
export const autoModeReadout = (options: {
  day: string;
  edits: DayReviewEdits;
  approvals: readonly ApprovalView[];
  classes: ActionClasses;
  standIns: readonly Pick<StandIn, 'id' | 'name' | 'state' | 'issueKey' | 'resolutionSource'>[];
  rows?: readonly Pick<ReviewedRow, 'id' | 'recutOf' | 'laneKey' | 'issueKey'>[];
}): AutoModeReadoutEntry[] =>
  [...ticketReadout(options), ...descriptionReadout({ edits: options.edits, rows: options.rows ?? [] })].sort(
    (left, right) => left.askedAtMs - right.askedAtMs,
  );
