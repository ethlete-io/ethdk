import { shiftDayKey } from '../review/day';
import { AGENT_API_OP_CLASSES, AgentApiRequest, OpClass } from './model';
import { parseAgentRequest } from './parse';

/** `running` is internal: the wire reads it as `queued` until the op has an outcome. */
export type AgentApprovalState = 'queued' | 'running' | 'approved' | 'rejected' | 'expired';

/** One write a caller asked for, waiting for the user's press or already decided. */
export type AgentApproval = {
  id: string;
  request: AgentApiRequest;
  opClass: OpClass;
  /** The name the calling CLI gave itself, when it gave one. */
  client?: string;
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

  const name = [...raw]
    .filter((char) => char >= ' ' && char !== '\u007f')
    .join('')
    .trim();

  return name ? name.slice(0, CLIENT_MAX_LENGTH) : undefined;
};

export const enqueueApproval = (
  queue: readonly AgentApproval[],
  options: { id: string; request: AgentApiRequest; client?: string; at: Date; day: string },
): AgentApproval[] => [
  ...queue,
  {
    id: options.id,
    request: options.request,
    opClass: AGENT_API_OP_CLASSES[options.request.op],
    ...(options.client ? { client: options.client } : {}),
    askedAtMs: options.at.getTime(),
    day: options.day,
    state: 'queued',
  },
];

/** Expires every item still waiting from a day before `today`, and drops decided ones past the keep. */
export const settleApprovalQueue = (queue: readonly AgentApproval[], today: string): AgentApproval[] => {
  const keepFrom = shiftDayKey(today, -AGENT_APPROVAL_KEEP_DAYS);

  return queue
    .filter((item) => item.state === 'queued' || item.state === 'running' || item.day >= keepFrom)
    .map((item) => (item.state === 'queued' && item.day < today ? { ...item, state: 'expired' } : item));
};

/** The items "Approve all" carries out: every waiting one that is not `human-only`. */
export const approvableByAll = (queue: readonly AgentApproval[]) =>
  queue.filter((item) => item.state === 'queued' && item.opClass !== 'human-only');

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

/**
 * Reads the queue the store holds. Each request goes through `parseAgentRequest` again and its class
 * comes from the table, so a stored document cannot carry a field or a class the endpoint would not.
 * An item that was running when the app stopped reads as approved with an error: whether it landed
 * is unknown, and running it a second time could file twice.
 */
export const parseApprovalQueue = (stored: unknown): AgentApproval[] => {
  if (!Array.isArray(stored)) return [];

  return stored.flatMap((entry): AgentApproval[] => {
    const raw = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {};
    const parsed = parseAgentRequest(raw['request']);
    const state = STATES.find((known) => known === raw['state']);
    const id = typeof raw['id'] === 'string' ? raw['id'] : '';
    const day = typeof raw['day'] === 'string' ? raw['day'] : '';
    const askedAtMs = typeof raw['askedAtMs'] === 'number' ? raw['askedAtMs'] : undefined;

    if (!parsed.ok || !state || !id || !DAY_KEY.test(day) || askedAtMs === undefined) return [];

    const client = agentApiClientOf(raw);
    const decidedAtMs = typeof raw['decidedAtMs'] === 'number' ? raw['decidedAtMs'] : undefined;
    const error = typeof raw['error'] === 'string' ? raw['error'] : undefined;

    return [
      {
        id,
        request: parsed.request,
        opClass: AGENT_API_OP_CLASSES[parsed.request.op],
        ...(client ? { client } : {}),
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

/** One line saying what an approved request writes, for the queue panel. */
export const describeApproval = (request: AgentApiRequest) => {
  switch (request.op) {
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
