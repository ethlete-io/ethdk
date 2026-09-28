import { AgentApiRequest } from '../agent-api/model';
import { UnnamedContext } from '../model/attribution';
import { contextKey, dominantContext } from '../model/block';
import { mayAutoWrite, rowFieldSourceOf } from '../model/field-source';
import { StandIn, standInResolutionSourceOf } from '../model/stand-in';
import { WorkGroup } from '../rows/merge';
import { unnamedRowId } from '../rows/propose';
import { setRowIssue } from './edits';
import { AutoModeAnswer, AutoModeSubject, DayReviewEdits, ReviewedRow } from './model';

/** The name the approval queue shows for everything auto mode asks for. */
export const AUTO_MODE_CLIENT = 'auto mode';

export const autoModeSubjectKey = (subject: AutoModeSubject) =>
  subject.kind === 'context' ? `context:${subject.contextId}` : `stand-in:${subject.standInId}`;

/** What the approval queue keys an auto-mode create by, so a second ask for the same subject reuses it. */
export const autoModeApprovalTarget = (day: string, subject: AutoModeSubject) =>
  `${day}|${autoModeSubjectKey(subject)}`;

const answeredKeys = (answers: readonly AutoModeAnswer[]) =>
  new Set(answers.map((answer) => autoModeSubjectKey(answer.subject)));

/**
 * What auto mode still has to ask about on a day: each unnamed context and each open stand-in the day
 * holds that holds no answer yet. Nothing on any day but today, and nothing while auto mode is off.
 * A stand-in the user reopened is theirs, so it is left alone until a reset hands it back.
 */
export const autoModeAsks = (options: {
  enabled: boolean;
  day: string;
  today: string;
  contexts: readonly UnnamedContext[];
  /** The contexts a standing rule already answers, which the day still lists but never asks about. */
  ruledContextIds?: ReadonlySet<string>;
  standIns: readonly Pick<StandIn, 'id' | 'state' | 'days' | 'resolutionSource'>[];
  answers: readonly AutoModeAnswer[];
}): AutoModeSubject[] => {
  if (!options.enabled || options.day !== options.today) return [];

  const answered = answeredKeys(options.answers);
  const contexts = options.contexts
    .filter((context) => !options.ruledContextIds?.has(context.id))
    .map((context): AutoModeSubject => ({ kind: 'context', contextId: context.id }));
  const standIns = options.standIns
    .filter(
      (standIn) =>
        standIn.state === 'open' &&
        standIn.days.includes(options.day) &&
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
  approval: { id: string; request: AgentApiRequest },
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
}): DayReviewEdits => {
  const keys = new Map<string, string>();

  for (const answer of options.edits.auto ?? []) {
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
