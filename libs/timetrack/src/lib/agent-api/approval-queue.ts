import { shiftDayKey } from '../review/day';
import { AutoModeSubject, DisputedTarget } from '../review/model';
import { AUTO_MODE_CLIENT, ActionClasses, actionClassOf, stricterClass } from './action-classes';
import { AGENT_API_OP_CLASSES, AgentApiRequest, OpClass } from './model';
import { parseAgentRequest } from './parse';

/**
 * A `local` auto mode action the user made stricter, waiting in the queue: name the subject's band or
 * resolve its stand-in with the issue the match found. Only auto mode queues one; no CLI can send it.
 */
export type AutoModeApplyRequest = {
  op: 'autoMode.apply';
  day: string;
  subject: AutoModeSubject;
  /** The band's or the stand-in's name, as the queue panel shows it. */
  label: string;
  issueKey: string;
  /** Jira has the issue done: auto mode never writes the match without this approval. */
  done?: true;
  /** The issue is a parent of other issues: auto mode never writes the match without this approval. */
  parent?: true;
};

/**
 * Auto mode's suggestion to hide the rest band of a call that went off topic. It always waits for the
 * user's press, and hiding is undone by showing the row again. Only auto mode queues one.
 */
export type AutoModeHideRequest = {
  op: 'autoMode.hide';
  day: string;
  rowId: string;
  /** The call's name, as the queue panel shows it. */
  label: string;
  fromMs: number;
};

/**
 * Auto mode's answer for a band two rungs disagree about, waiting where the user made `autoMode.apply`
 * stricter than `local`: keep the key the band books, or take the other answer. Only auto mode queues one.
 */
export type AutoModeResolveRequest = {
  op: 'autoMode.resolve';
  day: string;
  rowId: string;
  /** The band's lane, as the queue panel shows it. */
  label: string;
  booked: string;
  other: DisputedTarget;
  choice: 'keep' | 'use';
  reason: string;
};

export type AutoModeRequest = AutoModeApplyRequest | AutoModeHideRequest | AutoModeResolveRequest;

export type AgentApprovalRequest = AgentApiRequest | AutoModeRequest;

export const isAgentApiRequest = (request: AgentApprovalRequest): request is AgentApiRequest =>
  request.op !== 'autoMode.apply' && request.op !== 'autoMode.hide' && request.op !== 'autoMode.resolve';

/** `running` is internal: the wire reads it as `queued` until the op has an outcome. */
export type AgentApprovalState = 'queued' | 'running' | 'approved' | 'rejected' | 'expired';

/** One write a caller asked for, waiting for the user's press or already decided. */
export type AgentApproval = {
  id: string;
  request: AgentApprovalRequest;
  /** The class it was queued at. What the queue acts on is {@link approvalClassOf}, which a setting can raise. */
  opClass: OpClass;
  /** The name the calling CLI gave itself, when it gave one. */
  client?: string;
  /** What the item is for, as its asker names it. A waiting item holds its target against a second ask. */
  target?: string;
  askedAtMs: number;
  /** The local day key it was asked on. It expires once that day is over. */
  day: string;
  state: AgentApprovalState;
  decidedAtMs?: number;
  /** What the op answered, once approved and carried out. */
  result?: unknown;
  /** Why the approved op failed. */
  error?: string;
};

export type AgentApiQueued = { status: 'queued'; approvalId: string };

export type AgentApiApprovalStatus =
  | { status: 'queued' | 'rejected' | 'expired'; approvalId: string }
  | { status: 'approved'; approvalId: string; result?: unknown; error?: string };

/** How many days a decided item is kept, so a caller that polls late still reads its outcome. */
export const AGENT_APPROVAL_KEEP_DAYS = 7;

export const AGENT_APPROVAL_INTERRUPTED =
  'Timetrack stopped while carrying this out. Check whether it landed before asking again.';

const CLIENT_MAX_LENGTH = 60;

/**
 * Whether a request waits in the queue rather than being answered at once.
 *
 * A read never waits. A `standIn.split` without `apply` and a `tempo.sync` without a `planHash` only
 * plan, so they write nothing and are answered directly.
 */
export const routesThroughApproval = (request: AgentApiRequest) => {
  if (AGENT_API_OP_CLASSES[request.op] === 'read') return false;
  if (request.op === 'standIn.split') return request.apply;
  if (request.op === 'tempo.sync') return request.planHash !== undefined;

  return true;
};

/** The name a caller gave itself in the request body, cut to one short printable line. */
export const agentApiClientOf = (body: unknown) => {
  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>)['client'] : undefined;

  if (typeof raw !== 'string') return undefined;

  const name = raw.replace(/[\p{Cc}\p{Cf}]/gu, '').trim();

  return name ? name.slice(0, CLIENT_MAX_LENGTH) : undefined;
};

/** The name a CLI gave itself, where it is not the one auto mode's own items carry. */
export const agentApiCallerOf = (body: unknown) => {
  const client = agentApiClientOf(body);

  return client?.toLowerCase() === AUTO_MODE_CLIENT ? undefined : client;
};

const tableClassOfRequest = (request: AgentApprovalRequest): OpClass =>
  isAgentApiRequest(request) ? AGENT_API_OP_CLASSES[request.op] : 'external';

/**
 * The class an item has now. A create auto mode queued follows `autoMode.create`, a queued apply
 * `autoMode.apply`, and a CLI write its own op; a setting can only raise the table's class.
 */
export const approvalClassOf = (
  item: Pick<AgentApproval, 'request' | 'client' | 'opClass'>,
  classes: ActionClasses,
) => {
  const { request } = item;

  if (!isAgentApiRequest(request)) return stricterClass(item.opClass, actionClassOf('autoMode.apply', classes));
  if (request.op === 'jira.create' && item.client === AUTO_MODE_CLIENT) {
    return stricterClass(item.opClass, actionClassOf('autoMode.create', classes));
  }

  return stricterClass(item.opClass, actionClassOf(request.op, classes));
};

/** The item still waiting that the same caller queued for the same target. */
export const openApprovalFor = (queue: readonly AgentApproval[], options: { client?: string; target: string }) =>
  queue.find(
    (item) =>
      (item.state === 'queued' || item.state === 'running') &&
      item.target === options.target &&
      item.client === options.client,
  );

/** Adds a waiting item. A target an item from the same caller still waits for queues nothing. */
export const enqueueApproval = (
  queue: readonly AgentApproval[],
  options: { id: string; request: AgentApprovalRequest; client?: string; target?: string; at: Date; day: string },
): AgentApproval[] => {
  const { target } = options;

  if (target && openApprovalFor(queue, { client: options.client, target })) return [...queue];

  return [
    ...queue,
    {
      id: options.id,
      request: options.request,
      opClass: tableClassOfRequest(options.request),
      ...(options.client ? { client: options.client } : {}),
      ...(target ? { target } : {}),
      askedAtMs: options.at.getTime(),
      day: options.day,
      state: 'queued',
    },
  ];
};

/** Expires every item still waiting from a day before `today`, and drops decided ones past the keep. */
export const settleApprovalQueue = (queue: readonly AgentApproval[], today: string): AgentApproval[] => {
  const keepFrom = shiftDayKey(today, -AGENT_APPROVAL_KEEP_DAYS);

  return queue
    .filter((item) => item.state === 'queued' || item.state === 'running' || item.day >= keepFrom)
    .map((item) => (item.state === 'queued' && item.day < today ? { ...item, state: 'expired' } : item));
};

/** The items "Approve all" carries out: every waiting one that is not `human-only` now. */
export const approvableByAll = (queue: readonly AgentApproval[], classes: ActionClasses = {}) =>
  queue.filter((item) => item.state === 'queued' && approvalClassOf(item, classes) !== 'human-only');

export const markApproval = (
  queue: readonly AgentApproval[],
  change: Pick<AgentApproval, 'id' | 'state'> & Partial<Pick<AgentApproval, 'decidedAtMs' | 'result' | 'error'>>,
): AgentApproval[] => queue.map((item) => (item.id === change.id ? { ...item, ...change } : item));

export const approvalStatusOf = (item: AgentApproval): AgentApiApprovalStatus => {
  if (item.state === 'running' || item.state === 'queued') return { status: 'queued', approvalId: item.id };
  if (item.state !== 'approved') return { status: item.state, approvalId: item.id };

  return {
    status: 'approved',
    approvalId: item.id,
    ...(item.error === undefined ? { result: item.result } : { error: item.error }),
  };
};

const STATES: readonly AgentApprovalState[] = ['queued', 'running', 'approved', 'rejected', 'expired'];

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const textOf = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const asAutoModeSubject = (value: unknown): AutoModeSubject | undefined => {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const contextId = textOf(raw['contextId']);
  const standInId = textOf(raw['standInId']);

  if (raw['kind'] === 'context' && contextId) return { kind: 'context', contextId };
  if (raw['kind'] === 'stand-in' && standInId) return { kind: 'stand-in', standInId };

  return undefined;
};

const parseAutoModeApply = (value: unknown): AutoModeApplyRequest | undefined => {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const day = textOf(raw['day']);
  const subject = asAutoModeSubject(raw['subject']);
  const issueKey = textOf(raw['issueKey']).toUpperCase();

  if (raw['op'] !== 'autoMode.apply' || !DAY_KEY.test(day) || !subject || !issueKey) return undefined;

  return {
    op: 'autoMode.apply',
    day,
    subject,
    label: textOf(raw['label']),
    issueKey,
    ...(raw['done'] === true ? { done: true as const } : {}),
    ...(raw['parent'] === true ? { parent: true as const } : {}),
  };
};

const parseAutoModeHide = (value: unknown): AutoModeHideRequest | undefined => {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const day = textOf(raw['day']);
  const rowId = textOf(raw['rowId']);
  const fromMs = raw['fromMs'];

  if (raw['op'] !== 'autoMode.hide' || !DAY_KEY.test(day) || !rowId || typeof fromMs !== 'number') return undefined;

  return { op: 'autoMode.hide', day, rowId, label: textOf(raw['label']), fromMs };
};

const asDisputedTarget = (value: unknown): DisputedTarget | undefined => {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const issueKey = textOf(raw['issueKey']).toUpperCase();
  const standInId = textOf(raw['standInId']);

  if (raw['kind'] === 'issue' && issueKey) return { kind: 'issue', issueKey };
  if (raw['kind'] === 'stand-in' && standInId) return { kind: 'stand-in', standInId };

  return undefined;
};

const parseAutoModeResolve = (value: unknown): AutoModeResolveRequest | undefined => {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const day = textOf(raw['day']);
  const rowId = textOf(raw['rowId']);
  const booked = textOf(raw['booked']).toUpperCase();
  const other = asDisputedTarget(raw['other']);
  const choice = raw['choice'];

  if (raw['op'] !== 'autoMode.resolve' || !DAY_KEY.test(day) || !rowId || !booked || !other) return undefined;
  if (choice !== 'keep' && choice !== 'use') return undefined;

  return {
    op: 'autoMode.resolve',
    day,
    rowId,
    label: textOf(raw['label']),
    booked,
    other,
    choice,
    reason: textOf(raw['reason']),
  };
};

const parseApprovalRequest = (value: unknown): AgentApprovalRequest | undefined => {
  const applied = parseAutoModeApply(value) ?? parseAutoModeHide(value) ?? parseAutoModeResolve(value);

  if (applied) return applied;

  const parsed = parseAgentRequest(value);

  return parsed.ok ? parsed.request : undefined;
};

/**
 * Reads the queue the store holds. Each request goes through `parseAgentRequest` or the auto mode
 * apply reader again and its class comes from the table, so a stored document cannot carry a field or
 * a class the endpoint would not.
 * An item that was running when the app stopped reads as approved with an error: whether it landed
 * is unknown, and running it a second time could file twice.
 */
export const parseApprovalQueue = (stored: unknown): AgentApproval[] => {
  if (!Array.isArray(stored)) return [];

  return stored.flatMap((entry): AgentApproval[] => {
    const raw = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {};
    const request = parseApprovalRequest(raw['request']);
    const state = STATES.find((known) => known === raw['state']);
    const id = typeof raw['id'] === 'string' ? raw['id'] : '';
    const day = typeof raw['day'] === 'string' ? raw['day'] : '';
    const askedAtMs = typeof raw['askedAtMs'] === 'number' ? raw['askedAtMs'] : undefined;

    if (!request || !state || !id || !DAY_KEY.test(day) || askedAtMs === undefined) return [];

    const client = agentApiClientOf(raw);
    const decidedAtMs = typeof raw['decidedAtMs'] === 'number' ? raw['decidedAtMs'] : undefined;
    const error = typeof raw['error'] === 'string' ? raw['error'] : undefined;
    const target = typeof raw['target'] === 'string' && raw['target'] ? raw['target'] : undefined;

    return [
      {
        id,
        request,
        opClass: tableClassOfRequest(request),
        ...(client ? { client } : {}),
        ...(target ? { target } : {}),
        askedAtMs,
        day,
        ...(state === 'running'
          ? { state: 'approved', error: AGENT_APPROVAL_INTERRUPTED }
          : {
              state,
              ...('result' in raw ? { result: raw['result'] } : {}),
              ...(error === undefined ? {} : { error }),
            }),
        ...(decidedAtMs === undefined ? {} : { decidedAtMs }),
      },
    ];
  });
};

const minutesOf = (ms: number) => `${Math.round(ms / 60_000)}m`;

/** The other answer of a disputed band in a few words: its key, or that it is work with no ticket yet. */
export const disputedTargetLabel = (target: DisputedTarget) =>
  target.kind === 'issue' ? target.issueKey : 'work with no ticket yet';

/** One line saying what an approved request writes, for the queue panel. */
export const describeApproval = (request: AgentApprovalRequest) => {
  switch (request.op) {
    case 'autoMode.apply':
      return request.subject.kind === 'context'
        ? `Names today's ${request.label} band with ${request.issueKey}`
        : `Resolves stand-in ${request.label} with ${request.issueKey}${request.done ? ', which Jira has done' : ''}${request.parent ? ', a parent issue' : ''}`;
    case 'autoMode.resolve':
      return `${request.choice === 'keep' ? `Keeps ${request.booked}` : `Takes ${disputedTargetLabel(request.other)} instead of ${request.booked}`} on today's ${request.label} band: ${request.reason}`;
    case 'autoMode.hide':
      return `Hides the rest of the ${request.label || 'call'} call, which went off topic`;
    case 'jira.create':
      return `Files a Jira issue in ${request.projectKey ?? 'the picked project'}: ${request.summary}`;
    case 'worklog.add':
      return `Adds a ${minutesOf(request.durationMs)} row for ${request.issueKey} to the day`;
    case 'day.edits':
      return `Edits ${request.edits.length} row(s) on ${request.day}`;
    case 'standIn.remove':
      return `Deletes stand-in ${request.id} and the rule that names it`;
    case 'standIn.rename':
      return `Renames stand-in ${request.id} to ${request.name}`;
    case 'standIn.merge':
      return `Merges stand-in ${request.id} into ${request.into}`;
    case 'standIn.resolve':
      return `Resolves stand-in ${request.name ?? request.id}: ${request.fromIssueKey ? `${request.fromIssueKey} → ` : ''}${`${request.issueKey} ${request.summary ?? ''}`.trim()}`;
    case 'standIn.split':
      return `Splits stand-in ${request.id} into one per directory`;
    case 'tempo.sync':
      return `Writes the plan of ${request.day} to Tempo`;
    case 'tempo.delete':
      return `Deletes Tempo worklog ${request.worklogId} on ${request.day}`;
    case 'agentSessions.resync':
      return `Reads the agent sessions of ${request.paths.join(', ')} again${request.replace ? ', replacing them' : ''}`;
    default:
      return request.op;
  }
};

/** One item that still waits, as `approvals.list` answers it. `running` was approved and is being carried out. */
export type AgentApiWaitingApproval = {
  approvalId: string;
  state: 'queued' | 'running';
  op: AgentApprovalRequest['op'];
  client?: string;
  askedAtMs: number;
  /** What it writes once approved, in the words of the queue panel. */
  summary: string;
};

/** The items that still wait, in the order the queue panel lists them. */
export const waitingApprovalsOf = (queue: readonly AgentApproval[]): AgentApiWaitingApproval[] =>
  queue
    .filter((item) => item.state === 'queued' || item.state === 'running')
    .map((item) => ({
      approvalId: item.id,
      state: item.state === 'running' ? 'running' : 'queued',
      op: item.request.op,
      ...(item.client ? { client: item.client } : {}),
      askedAtMs: item.askedAtMs,
      summary: describeApproval(item.request),
    }));

export type AgentApprovalRejection = { ok: true; queue: AgentApproval[] } | { ok: false; message: string };

/** Rejects one item that waits for the user's press. Any other item is refused, and the queue stays as it is. */
export const rejectApproval = (
  queue: readonly AgentApproval[],
  options: { id: string; decidedAtMs: number },
): AgentApprovalRejection => {
  const { id } = options;
  const item = queue.find((entry) => entry.id === id);

  if (!item) return { ok: false, message: `Timetrack holds no approval ${id}. Nothing changed.` };
  if (item.state === 'running') {
    return { ok: false, message: `Approval ${id} was approved and is being carried out. Nothing changed.` };
  }
  if (item.state !== 'queued') {
    return { ok: false, message: `Approval ${id} is ${item.state} already, so it waits for nothing. Nothing changed.` };
  }

  return { ok: true, queue: markApproval(queue, { id, state: 'rejected', decidedAtMs: options.decidedAtMs }) };
};
