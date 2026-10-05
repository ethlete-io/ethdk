import { AUTO_MODE_CLIENT, ActionClasses, actionClassOf } from '../agent-api/action-classes';
import { AgentApproval, AgentApprovalRequest, AutoModeApplyRequest } from '../agent-api/approval-queue';
import { AgentApiRequest } from '../agent-api/model';
import { GitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { JiraIssue } from '../jira/issue';
import { draftTicket } from '../ticket/draft';
import { UnnamedContext } from '../model/attribution';
import { contextKey, dominantContext, streamKeyLabel } from '../model/block';
import { RowFieldSources, mayAutoWrite, rowFieldSourceOf } from '../model/field-source';
import { StandIn, standInResolutionSourceOf } from '../model/stand-in';
import { WorkGroup } from '../rows/merge';
import { unnamedRowId } from '../rows/propose';
import { setRowIssue } from './edits';
import { WorklogWritingRequest } from '../ticket/worklog';
import { TicketWritingRequest, standInWritingRequest, ticketWritingRequest } from '../ticket/write';
import { autoDescriptionRowId, storedDescriptionSource } from './auto-description';
import { autoDisputeApplied, autoDisputeDoneChoice, autoDisputeOverruled, autoModeResolveTarget } from './auto-dispute';
import { DisputeResolvingRequest } from '../ticket/dispute';
import { disputedTargetLabel } from '../agent-api/approval-queue';
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
  /** The stand-ins, which say what a resolved one's rows are keyed by now. */
  standIns?: readonly Pick<StandIn, 'id' | 'state' | 'issueKey'>[];
}): string[] => {
  const { item, day, rows } = options;
  const { request } = item;

  if (request.op === 'standIn.resolve' || request.op === 'standIn.remove' || request.op === 'standIn.rename') {
    const standIn = options.standIns?.find((entry) => entry.id === request.id);
    const issueKey = standIn?.state === 'resolved' ? standIn.issueKey : undefined;

    return rows
      .filter((row) => row.standInId === request.id || (!!issueKey && row.issueKey === issueKey))
      .map((row) => row.id);
  }

  if (request.op === 'autoMode.apply') {
    return request.day === day
      ? subjectRowIds({ subject: request.subject, rows, unattributed: options.unattributed })
      : [];
  }

  if (request.op === 'autoMode.resolve') {
    return request.day === day
      ? rows.filter((row) => autoDescriptionRowId(row) === request.rowId).map((row) => row.id)
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
    const overlapOf = (entry: ReviewedRow) => Math.min(entry.to.getTime(), to) - Math.max(entry.from.getTime(), from);
    const named = overlapping.filter((entry) => entry.issueKey === request.issueKey);
    const row = (named.length ? named : overlapping).reduce<ReviewedRow | undefined>(
      (best, entry) => (best && overlapOf(best) >= overlapOf(entry) ? best : entry),
      undefined,
    );

    return row ? [row.id] : [];
  }

  return [];
};

/**
 * Expires each waiting auto mode create for a stand-in that no longer waits: once it resolved, or was
 * removed, the drafted ticket would file work that already has an answer.
 */
export const withStaleStandInCreatesExpired = (
  queue: readonly AgentApproval[],
  standIns: readonly Pick<StandIn, 'id' | 'state'>[],
): AgentApproval[] => {
  const open = new Set(standIns.filter((standIn) => standIn.state === 'open').map((standIn) => standIn.id));

  return queue.map((item) => {
    if (item.state !== 'queued' || item.client !== AUTO_MODE_CLIENT || item.request.op !== 'jira.create') return item;

    const subject = subjectOfTarget(item.target, item.day);

    return subject?.kind === 'stand-in' && !open.has(subject.standInId) ? { ...item, state: 'expired' } : item;
  });
};

type ApprovalView = Pick<AgentApproval, 'id' | 'request' | 'target' | 'state' | 'result' | 'error'>;

const applyApprovalOf = (options: { approvals: readonly ApprovalView[]; day: string; subject: AutoModeSubject }) => {
  const target = autoModeApplyTarget(options.day, options.subject);

  return [...options.approvals]
    .reverse()
    .find((item) => item.target === target && item.request.op === 'autoMode.apply');
};

/**
 * Expires the waiting auto mode create and apply a subject holds on a day. A new answer for the subject
 * replaces them, and the queue would otherwise hand the new ask the old create's wording.
 */
export const withAutoModeSubjectItemsExpired = (
  queue: readonly AgentApproval[],
  options: { day: string; subject: AutoModeSubject },
): AgentApproval[] => {
  const targets = new Set([
    autoModeApprovalTarget(options.day, options.subject),
    autoModeApplyTarget(options.day, options.subject),
  ]);

  return queue.map((item) =>
    item.state === 'queued' && item.client === AUTO_MODE_CLIENT && item.target && targets.has(item.target)
      ? { ...item, state: 'expired' }
      : item,
  );
};

/**
 * Expires each waiting auto mode create and apply for a context of `day` that is no longer open: a rule,
 * a match or a stand-in named it after auto mode asked.
 */
export const withNamedContextItemsExpired = (
  queue: readonly AgentApproval[],
  options: { day: string; openContextIds: ReadonlySet<string> },
): AgentApproval[] =>
  queue.map((item) => {
    if (item.state !== 'queued' || item.client !== AUTO_MODE_CLIENT || item.day !== options.day) return item;
    if (item.request.op !== 'jira.create' && item.request.op !== 'autoMode.apply') return item;

    const subject = subjectOfTarget(item.target?.replace(/\|apply$/, ''), options.day);

    return subject?.kind === 'context' && !options.openContextIds.has(subject.contextId)
      ? { ...item, state: 'expired' }
      : item;
  });

/** The payload an ask about a subject sends. `null` for a context or stand-in the day no longer holds. */
export const autoModeSubjectRequest = (options: {
  subject: AutoModeSubject;
  contexts: readonly UnnamedContext[];
  unattributed: readonly WorkGroup[];
  standIns: readonly Pick<StandIn, 'id' | 'name' | 'description' | 'days'>[];
  config: GitFlowConfig;
  maskedNames: readonly string[];
  parents?: readonly JiraIssue[];
  issues?: readonly JiraIssue[];
  /** The days Tempo already holds, which a stand-in's request does not count. */
  bookedDays?: ReadonlySet<string>;
}): TicketWritingRequest | null => {
  const { subject, maskedNames } = options;
  const jira = { parents: options.parents ?? [], issues: options.issues ?? [] };

  if (subject.kind === 'stand-in') {
    const standIn = options.standIns.find((entry) => entry.id === subject.standInId);

    return standIn ? standInWritingRequest({ standIn, maskedNames, bookedDays: options.bookedDays, ...jira }) : null;
  }

  const context = options.contexts.find((entry) => entry.id === subject.contextId);

  if (!context) return null;

  const { notes } = draftTicket({ context, unattributed: options.unattributed, config: options.config });

  return ticketWritingRequest({ context, notes, maskedNames, ...jira });
};

/**
 * The evidence an ask was built from, as a string that changes only when that evidence does: the
 * checkout, the application, the notes and the stand-in's own wording. A band that only grows longer
 * keeps it, and so does a change to the issues Jira offers.
 */
export const autoModeEvidenceOf = (request: TicketWritingRequest) =>
  JSON.stringify([
    request.repo ?? null,
    request.branch ?? null,
    request.app ?? null,
    [...new Set(request.notes)].sort(),
    request.standIn ? [request.standIn.name, request.standIn.description ?? null] : null,
    request.spec ?? null,
  ]);

const stillAutos = (state: AgentApproval['state'] | undefined) => !state || state === 'queued' || state === 'expired';

/**
 * Whether an answer is still auto mode's to replace: no create of it was approved, and no apply of it
 * was approved or rejected.
 */
const autoModeOwns = (options: { day: string; answer: AutoModeAnswer; approvals: readonly ApprovalView[] }) => {
  const { outcome, subject } = options.answer;

  if (outcome.kind === 'draft') {
    if (outcome.createdKey) return false;

    return stillAutos(options.approvals.find((item) => item.id === outcome.approvalId)?.state);
  }

  if (outcome.kind === 'match') {
    return stillAutos(applyApprovalOf({ approvals: options.approvals, day: options.day, subject })?.state);
  }

  return true;
};

type AskRow = Pick<ReviewedRow, 'standInId' | 'issueKey' | 'sources'> & Partial<Pick<ReviewedRow, 'id' | 'recutOf'>>;

const contextIdsByRowId = (unattributed: readonly WorkGroup[]) => {
  const contextOfRow = new Map<string, string>();

  for (const group of unattributed) {
    const context = dominantContext(group.blocks);

    if (context) contextOfRow.set(unnamedRowId(group), contextKey(context));
  }

  return contextOfRow;
};

const handNamedContextIds = (options: { rows: readonly AskRow[]; unattributed: readonly WorkGroup[] }) => {
  const contextOfRow = contextIdsByRowId(options.unattributed);

  return new Set(
    options.rows.flatMap((row) => {
      const contextId = contextOfRow.get(row.id ?? '') ?? contextOfRow.get(row.recutOf ?? '');

      return contextId && rowFieldSourceOf(row, 'issue') === 'human' ? [contextId] : [];
    }),
  );
};

/**
 * The subject a press of "Ask auto mode again" on a row asks about, on any day and with auto mode off:
 * the open stand-in the row stands for, or the unnamed context behind it. `null` for a row whose issue
 * the user set by hand, one named by anything but auto mode, a hidden, unattended or excluded one, and
 * one a standing rule answers. Asking again replaces the stored answer through {@link withAutoModeAnswer}
 * and expires what the old one left waiting through {@link withAutoModeSubjectItemsExpired}.
 */
export const autoModeReaskSubjectOf = (options: {
  row: Pick<ReviewedRow, 'id' | 'standInId' | 'issueKey' | 'sources' | 'hidden' | 'unattended' | 'excluded'> &
    Partial<Pick<ReviewedRow, 'recutOf'>>;
  day: string;
  contexts: readonly Pick<UnnamedContext, 'id'>[];
  ruledContextIds?: ReadonlySet<string>;
  /** The day's unattributed groups, which say which context each unnamed row came from. */
  unattributed: readonly WorkGroup[];
  standIns: readonly Pick<StandIn, 'id' | 'state' | 'days' | 'resolutionSource'>[];
}): AutoModeSubject | null => {
  const { row } = options;
  const source = rowFieldSourceOf(row, 'issue');

  if (source === 'human' || (row.issueKey && source !== 'auto')) return null;
  if (row.hidden || row.unattended || row.excluded) return null;

  if (row.standInId) {
    const standIn = options.standIns.find((entry) => entry.id === row.standInId);

    return standIn?.state === 'open' &&
      standIn.days.includes(options.day) &&
      mayAutoWrite(standInResolutionSourceOf(standIn))
      ? { kind: 'stand-in', standInId: standIn.id }
      : null;
  }

  const contextOfRow = contextIdsByRowId(options.unattributed);
  const contextId = contextOfRow.get(row.id) ?? contextOfRow.get(row.recutOf ?? '');

  if (!contextId || options.ruledContextIds?.has(contextId)) return null;

  return options.contexts.some((context) => context.id === contextId) ? { kind: 'context', contextId } : null;
};

/**
 * Why an agent may not ask auto mode about a subject of a day, or `null` where it may. It refuses what
 * "Ask auto mode again" is never offered on: a stand-in Timetrack does not hold, one the day holds no
 * time of, a resolved one or one the user reopened, and a context the day holds no unnamed work of,
 * one a standing rule answers or one the user named by hand.
 */
export const autoModeAskRefusal = (options: {
  subject: AutoModeSubject;
  day: string;
  contexts: readonly Pick<UnnamedContext, 'id'>[];
  ruledContextIds?: ReadonlySet<string>;
  unattributed: readonly WorkGroup[];
  rows: readonly AskRow[];
  standIns: readonly Pick<StandIn, 'id' | 'state' | 'days' | 'resolutionSource'>[];
}): string | null => {
  const { subject, day } = options;

  if (subject.kind === 'stand-in') {
    const id = subject.standInId;
    const standIn = options.standIns.find((entry) => entry.id === id);

    if (!standIn) return `Timetrack holds no stand-in ${id}.`;
    if (!standIn.days.includes(day)) return `Stand-in ${id} holds no time on ${day}.`;
    if (standIn.state !== 'open') return `Stand-in ${id} is resolved already, so auto mode has nothing to ask.`;
    if (!mayAutoWrite(standInResolutionSourceOf(standIn))) {
      return `The user reopened stand-in ${id}, so auto mode leaves it to them.`;
    }

    return null;
  }

  const id = subject.contextId;

  if (!options.contexts.some((context) => context.id === id)) return `${day} holds no unnamed work of context ${id}.`;
  if (options.ruledContextIds?.has(id)) return `A standing rule names context ${id}, so auto mode is not asked.`;
  if (handNamedContextIds({ rows: options.rows, unattributed: options.unattributed }).has(id)) {
    return `The user named context ${id} by hand on ${day}, so auto mode leaves it to them.`;
  }

  return null;
};

/**
 * What auto mode still has to ask about on a day: each unnamed context and each open stand-in the day
 * holds that holds no answer yet, or whose answer is still auto mode's and was built from evidence the
 * day no longer holds. Nothing on any day but today, and nothing while auto mode is off. A stand-in the
 * user reopened is theirs, so it is left alone until a reset hands it back, and so is one whose row the
 * user gave a ticket by hand today. A context with a row the user named by hand is never asked again.
 */
export const autoModeAsks = (options: {
  enabled: boolean;
  day: string;
  today: string;
  contexts: readonly UnnamedContext[];
  /** The contexts a standing rule already answers, which the day still lists but never asks about. */
  ruledContextIds?: ReadonlySet<string>;
  standIns: readonly Pick<StandIn, 'id' | 'state' | 'days' | 'resolutionSource' | 'name' | 'description'>[];
  rows: readonly AskRow[];
  answers: readonly AutoModeAnswer[];
  /** What the day's evidence is built from now. Absent, an answered subject is never asked again. */
  evidence?: { unattributed: readonly WorkGroup[]; config: GitFlowConfig; maskedNames: readonly string[] };
  /** The approval queue. Absent, an answered subject is never asked again. */
  approvals?: readonly ApprovalView[];
}): AutoModeSubject[] => {
  if (!options.enabled || options.day !== options.today) return [];

  const { evidence, approvals } = options;
  const answers = new Map(options.answers.map((answer) => [autoModeSubjectKey(answer.subject), answer]));
  const handNamed = evidence ? handNamedContextIds({ rows: options.rows, unattributed: evidence.unattributed }) : null;
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

  const outdated = (subject: AutoModeSubject, answer: AutoModeAnswer) => {
    if (!evidence || !approvals || !handNamed) return false;
    if (subject.kind === 'context' && handNamed.has(subject.contextId)) return false;

    const request = autoModeSubjectRequest({
      subject,
      contexts: options.contexts,
      unattributed: evidence.unattributed,
      standIns: options.standIns,
      config: evidence.config,
      maskedNames: evidence.maskedNames,
    });

    return (
      !!request &&
      autoModeEvidenceOf(request) !== autoModeEvidenceOf(answer.request) &&
      autoModeOwns({ day: options.day, answer, approvals })
    );
  };

  return [...contexts, ...standIns].filter((subject) => {
    const answer = answers.get(autoModeSubjectKey(subject));

    return !answer || outdated(subject, answer);
  });
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
  const held = (edits.auto ?? []).find((entry) => autoModeSubjectKey(entry.subject) === key);
  const heldKey =
    held && (autoModeIssueKeyOf(held) ?? (held.outcome.kind === 'draft' ? held.outcome.supersededKey : undefined));
  const { outcome } = answer;
  const stored: AutoModeAnswer =
    outcome.kind === 'draft' && !outcome.createdKey && heldKey && heldKey !== outcome.supersededKey
      ? { ...answer, outcome: { ...outcome, supersededKey: heldKey } }
      : answer;

  return {
    ...edits,
    auto: [...(edits.auto ?? []).filter((entry) => autoModeSubjectKey(entry.subject) !== key), stored],
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
 * a second create would file the ticket twice.
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
 * `auto`, over the name an earlier answer gave it. A row the user named or cleared keeps their answer,
 * and a band nobody was at the machine for, or one a rule says is not work, stays the user's to name.
 * Where a new draft replaced a match, the rows that match named lose its issue until the create is approved.
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
    if (answer.outcome.kind === 'match' && answer.outcome.done) continue;

    const issueKey = autoModeIssueKeyOf(answer);

    if (answer.subject.kind === 'context' && issueKey) keys.set(answer.subject.contextId, issueKey);
  }

  const superseded = new Map<string, string>();

  for (const answer of options.edits.auto ?? []) {
    const { outcome } = answer;

    if (answer.subject.kind === 'context' && outcome.kind === 'draft' && !outcome.createdKey && outcome.supersededKey) {
      superseded.set(answer.subject.contextId, outcome.supersededKey);
    }
  }

  if (!keys.size && !superseded.size) return options.edits;

  const contextOfRow = new Map<string, string>();

  for (const group of options.unattributed) {
    const context = dominantContext(group.blocks);

    if (context) contextOfRow.set(unnamedRowId(group), contextKey(context));
  }

  return options.rows.reduce((edits, row) => {
    const source = rowFieldSourceOf(row, 'issue');

    if (row.standInId || row.hidden || row.unattended || row.excluded) return edits;
    if (source === 'human' || (row.issueKey && source !== 'auto')) return edits;

    const contextId = contextOfRow.get(row.id);

    if (contextId && source === 'auto' && row.issueKey && row.issueKey === superseded.get(contextId)) {
      return setRowIssue({ edits, row, issueKey: '', source: 'auto' });
    }

    const issueKey = contextId ? keys.get(contextId) : undefined;

    return issueKey && issueKey !== row.issueKey ? setRowIssue({ edits, row, issueKey, source: 'auto' }) : edits;
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

/**
 * The apply a match queues where the user made `autoMode.apply` stricter than `local`, and `null`
 * for any other answer or class. A stand-in's match on a done issue queues at `local` too, marked
 * `done`, since only an approval writes it; a band's stays the user's. A match on a parent issue queues
 * at `local` too, marked `parent`.
 */
export const autoModeApplyRequest = (options: {
  day: string;
  answer: AutoModeAnswer;
  label: string;
  classes: ActionClasses;
}): AutoModeApplyRequest | null => {
  const { outcome, subject } = options.answer;

  if (outcome.kind !== 'match') return null;

  const opClass = actionClassOf('autoMode.apply', options.classes);
  const request = { op: 'autoMode.apply' as const, day: options.day, subject, label: options.label };

  const marks = {
    ...(outcome.done ? { done: true as const } : {}),
    ...(outcome.parent ? { parent: true as const } : {}),
  };

  if (outcome.done && subject.kind !== 'stand-in') return null;
  if (outcome.done || outcome.parent) {
    return opClass === 'human-only' ? null : { ...request, issueKey: outcome.issueKey, ...marks };
  }

  return opClass === 'external' ? { ...request, issueKey: outcome.issueKey } : null;
};

/**
 * Whether auto mode may write what an answer found now. A match writes at `local`, at `external` once
 * its queued apply is approved, and never at `human-only` or after a rejected apply. The key an
 * approved create filed is written whatever the class. A match Jira had done is never written here:
 * only the approval of its queued apply writes it.
 */
export const autoModeApplies = (options: {
  day: string;
  answer: AutoModeAnswer;
  classes: ActionClasses;
  approvals: readonly ApprovalView[];
}) => {
  const { outcome, subject } = options.answer;

  if (outcome.kind === 'draft') return !!outcome.createdKey;
  if (outcome.kind !== 'match' || outcome.done) return false;

  const approval = applyApprovalOf({ approvals: options.approvals, day: options.day, subject });

  if (approval?.state === 'rejected') return false;

  const opClass = actionClassOf('autoMode.apply', options.classes);

  if (opClass === 'local' && !outcome.parent) return true;
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
  | 'done'
  | 'not-queued'
  | 'written'
  | 'unsure'
  | 'failed';

/** One thing auto mode asked about today, and what came of it, read from what the app stored. */
export type AutoModeReadoutEntry = {
  key: string;
  kind: AutoModeSubject['kind'] | 'description' | 'dispute';
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
  /** Why the model settled a disputed band the way it did. */
  reason?: string;
  error?: string;
  /** The masked payload that left the machine. */
  request: TicketWritingRequest | WorklogWritingRequest | DisputeResolvingRequest;
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

const disputeReadout = (options: {
  day: string;
  edits: DayReviewEdits;
  approvals: readonly ApprovalView[];
  classes: ActionClasses;
  rows: readonly Pick<ReviewedRow, 'id' | 'recutOf' | 'laneKey'>[];
}): AutoModeReadoutEntry[] =>
  (options.edits.autoDisputes ?? []).map((dispute): AutoModeReadoutEntry => {
    const row = options.rows.find((entry) => autoDescriptionRowId(entry) === dispute.rowId);
    const { answer } = dispute;
    const chosen =
      answer?.choice === 'keep'
        ? dispute.booked
        : answer?.choice === 'use'
          ? disputedTargetLabel(dispute.other)
          : undefined;
    const base = {
      key: `dispute:${dispute.rowId}`,
      kind: 'dispute' as const,
      label: row?.laneKey ? streamKeyLabel(row.laneKey) : (dispute.request.repo ?? 'a disputed band'),
      askedAtMs: dispute.askedAtMs,
      namedRows: 0,
      request: dispute.request,
      ...(chosen ? { issueKey: chosen } : {}),
      ...(answer?.reason ? { reason: answer.reason } : {}),
    };

    if (!answer) return { ...base, status: 'failed' };
    if (answer.choice === 'unsure') return { ...base, status: 'unsure' };
    if (autoDisputeDoneChoice(dispute)) return { ...base, status: 'done' };
    if (autoDisputeApplied(options.edits, dispute)) return { ...base, status: 'applied' };
    if (autoDisputeOverruled(options.edits, dispute)) return { ...base, status: 'overruled' };

    const target = autoModeResolveTarget(options.day, dispute.rowId);
    const approval = [...options.approvals].reverse().find((item) => item.target === target);

    if (approval) {
      const waiting = approvalStatusFor(approval);

      if (waiting) return { ...base, status: waiting, ...(approval.error ? { error: approval.error } : {}) };

      return { ...base, status: 'approved' };
    }

    if (actionClassOf('autoMode.apply', options.classes) === 'human-only') return { ...base, status: 'held' };

    return { ...base, status: 'unused' };
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

    if (outcome.done) return { ...found, status: 'done' };

    if (actionClassOf('autoMode.apply', options.classes) === 'human-only') return { ...found, status: 'held' };

    return { ...found, status: 'unused' };
  });

/**
 * What auto mode did on a day, one entry per band or stand-in it asked about, per row it described and
 * per disputed band it settled, oldest first. Every status is read from the stored answers, rows, stand-ins and queue, never from
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
  [
    ...ticketReadout(options),
    ...descriptionReadout({ edits: options.edits, rows: options.rows ?? [] }),
    ...disputeReadout({ ...options, rows: options.rows ?? [] }),
  ].sort((left, right) => left.askedAtMs - right.askedAtMs);
