import type { AgentApiApprovalStatus, AgentApiQueued } from '../agent-api/approval-queue';
import type { AgentApiInstance, AgentApiIssue, AgentApiOp, AgentApiRequest, AgentApiStatus } from '../agent-api/model';
import { askTimetrack } from './client.mts';

const MCP_PROTOCOL_VERSION = '2025-06-18';
const SERVER_INSTRUCTIONS = [
  'Use status first to check integrations and Jira projects. If Timetrack is unavailable, ask the user to start the app. The app manages credentials. Never ask for tokens or store them in a checkout.',
  'Use the app’s Jira project, issue type and hierarchy settings. Queue changes only when the user asks in this conversation.',
  'The human approves writes in the Timetrack app. Every write tool queues a request and returns its approvalId.',
  'Tell the user the request is queued. Check approval_status with that ID once they say they have decided. Never poll. A request still waiting at the end of its day expires.',
  'When tidying a day, book rows between midnight and 06:00 only with desk evidence. Assign background time from 08:00 to 20:00 to the nearest project block when there is project evidence. Ask before booking more than 8 hours in a day or 40 in a week.',
].join('\n');

type FieldType = 'string' | 'boolean' | 'integer' | 'object' | 'strings' | 'objects';
type FieldSchema = {
  type: 'string' | 'boolean' | 'integer' | 'object' | 'array';
  items?: { type: 'string' | 'object' };
};
type InputSchema = {
  type: 'object';
  properties: Record<string, FieldSchema>;
  required: string[];
  additionalProperties: false;
};

type Tool = {
  name: string;
  description: string;
  inputSchema: InputSchema;
  run: (args: Record<string, unknown>) => Promise<object>;
};

const fieldSchema = (type: FieldType): FieldSchema => {
  if (type === 'strings') return { type: 'array', items: { type: 'string' } };
  if (type === 'objects') return { type: 'array', items: { type: 'object' } };

  return { type };
};

const inputSchema = (fields: Record<string, FieldType> = {}, required: string[] = []): InputSchema => ({
  type: 'object',
  properties: Object.fromEntries(Object.entries(fields).map(([name, type]) => [name, fieldSchema(type)])),
  required,
  additionalProperties: false,
});

type ToolArguments<TOp extends AgentApiRequest['op']> = Omit<Extract<AgentApiRequest, { op: TOp }>, 'op'>;

const objectOf = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const forward =
  (op: AgentApiOp, defaults: Record<string, unknown> = {}, fixed: Record<string, unknown> = {}) =>
  (args: Record<string, unknown>) =>
    askTimetrack<object>({ ...defaults, ...args, ...fixed, op } as AgentApiRequest);

const queue =
  (op: AgentApiOp, defaults: Record<string, unknown> = {}, fixed: Record<string, unknown> = {}) =>
  async (args: Record<string, unknown>): Promise<AgentApiQueued> => {
    const receipt = objectOf(await askTimetrack<unknown>({ ...defaults, ...args, ...fixed, op } as AgentApiRequest));
    const approvalId = receipt?.['approvalId'];

    if (receipt?.['status'] !== 'queued' || typeof approvalId !== 'string' || !approvalId.trim()) {
      throw new Error('Timetrack did not return a queued approval receipt. Check the approval queue in the app.');
    }

    return { status: 'queued', approvalId };
  };

const queuedTool = (
  name: string,
  op: AgentApiOp,
  description: string,
  schema: InputSchema,
  defaults?: Record<string, unknown>,
): Tool => ({
  name,
  description: `${description} Queues the change for human approval and returns its approval ID.`,
  inputSchema: schema,
  run: queue(op, defaults),
});

const tools: Tool[] = [
  {
    name: 'status',
    description: 'Report which Timetrack integrations and Jira projects are configured.',
    inputSchema: inputSchema(),
    run: () => askTimetrack<AgentApiStatus>({ op: 'status' }),
  },
  {
    name: 'jira_instance',
    description: 'Read the Jira issue hierarchy and candidate branch-subject fields.',
    inputSchema: inputSchema(),
    run: () => askTimetrack<AgentApiInstance>({ op: 'jira.instance' }),
  },
  {
    name: 'jira_issue',
    description:
      'Read a known Jira key for its summary, type and parent. Prefer its subject for branch naming when set.',
    inputSchema: inputSchema({ key: 'string' }, ['key']),
    run: ({ key }) => askTimetrack<{ issue: AgentApiIssue }>({ op: 'jira.issue', key: key as string }),
  },
  {
    name: 'jira_search',
    description:
      'Find Jira issues by text when the key is unknown. Searches the app’s selected projects unless you pass projectKey.',
    inputSchema: inputSchema({ text: 'string', projectKey: 'string', assignedToMe: 'boolean', limit: 'integer' }),
    run: (args) =>
      askTimetrack<{ issues: AgentApiIssue[] }>({
        text: '',
        assignedToMe: false,
        ...(args as Partial<ToolArguments<'jira.search'>>),
        op: 'jira.search',
      }),
  },
  queuedTool(
    'jira_create',
    'jira.create',
    'File a Jira issue with the app’s ticket settings. Pass projectKey unless exactly one project is selected in the app.',
    inputSchema(
      {
        summary: 'string',
        description: 'string',
        projectKey: 'string',
        issueTypeName: 'string',
        parentKey: 'string',
        subject: 'string',
      },
      ['summary'],
    ),
    { description: '' },
  ),
  {
    name: 'approval_status',
    description: 'Read a queued write by approval ID for its status and, if approved, its result.',
    inputSchema: inputSchema({ id: 'string' }, ['id']),
    run: ({ id }) => askTimetrack<AgentApiApprovalStatus>({ op: 'approval.status', id: id as string }),
  },
  {
    name: 'approvals_list',
    description: 'List the writes that still wait for approval in the app, from every caller.',
    inputSchema: inputSchema(),
    run: forward('approvals.list'),
  },
  {
    name: 'approval_reject',
    description: 'Reject a pending write if the user asks or you queued it by mistake.',
    inputSchema: inputSchema({ id: 'string' }, ['id']),
    run: forward('approval.reject'),
  },
  {
    name: 'naming_offers',
    description:
      'Find why a checkout was or was not offered a name on a day (YYYY-MM-DD). Check the Tempo history status first if it is failed or no-token.',
    inputSchema: inputSchema({ day: 'string' }, ['day']),
    run: forward('naming.offers'),
  },
  {
    name: 'repo_project',
    description: 'Read which Jira project a checkout path belongs to.',
    inputSchema: inputSchema({ repoPath: 'string' }, ['repoPath']),
    run: forward('repo.project'),
  },
  {
    name: 'day_events',
    description:
      'Read what collectors observed on one day (YYYY-MM-DD). Set received for the original events. Summarize relevant evidence without reproducing the event dump.',
    inputSchema: inputSchema({ day: 'string', received: 'boolean' }, ['day']),
    run: ({ day, received }) => forward('day.events')(received === true ? { day, received } : { day }),
  },
  {
    name: 'day_transcript',
    description:
      'Read the user’s microphone transcript for one day (YYYY-MM-DD) only when the task needs what was said. Available if enabled and retained for seven days.',
    inputSchema: inputSchema({ day: 'string' }, ['day']),
    run: forward('transcript.day'),
  },
  {
    name: 'day_rows',
    description:
      'Read the rows Timetrack drew for a day (YYYY-MM-DD), with edit IDs, totals, warnings and presence evidence. Use fresh IDs for edits to an active day.',
    inputSchema: inputSchema({ day: 'string' }, ['day']),
    run: forward('day.rows'),
  },
  {
    name: 'day_inputs',
    description: 'Read the inputs the app built the rows of one day (YYYY-MM-DD) from.',
    inputSchema: inputSchema({ day: 'string' }, ['day']),
    run: forward('day.inputs'),
  },
  queuedTool(
    'day_add_work',
    'worklog.add',
    'Record unobserved work as a Timetrack row for an issue. Pass the start as epoch milliseconds and the duration in milliseconds. The user reviews the row before syncing it to Tempo.',
    inputSchema({ issueKey: 'string', description: 'string', fromMs: 'integer', durationMs: 'integer' }, [
      'issueKey',
      'fromMs',
      'durationMs',
    ]),
    { description: '' },
  ),
  queuedTool(
    'day_edit',
    'day.edits',
    'Batch a day’s corrections in one approval using fresh IDs from day_rows. Each edit is {kind:"range",rowId,fromMs,toMs}, {kind:"issue",rowId,issueKey}, {kind:"description",rowId,description}, {kind:"state",rowId,state:"accepted"|"rejected"}, {kind:"hidden",rowId,hidden} or {kind:"reset",rowId}. After approval, check applied for how many edits found their row.',
    inputSchema({ day: 'string', edits: 'objects' }, ['day', 'edits']),
  ),
  {
    name: 'tempo_worklogs',
    description:
      'Read what the user already booked in Tempo, including entries from other callers (YYYY-MM-DD, inclusive, up to 92 days). Quote descriptions only when needed.',
    inputSchema: inputSchema({ from: 'string', to: 'string' }, ['from', 'to']),
    run: forward('tempo.worklogs'),
  },
  {
    name: 'tempo_sync_plan',
    description:
      'Preview the Tempo creates, updates and deletes for a day (YYYY-MM-DD). Returns planHash and reports held rows, including empty descriptions, and foreign worklogs left untouched.',
    inputSchema: inputSchema({ day: 'string' }, ['day']),
    run: forward('tempo.sync'),
  },
  queuedTool(
    'tempo_sync_apply',
    'tempo.sync',
    'Show the user the planned changes and get confirmation in this conversation before passing that planHash. Ask the user to approve this request individually in the app. If the plan changes, preview and confirm again. Check per-row results with approval_status. Retry failures only on the app’s Sync page to avoid duplicates. If writes went unrecorded, ask the user to remove them in Tempo before syncing again.',
    inputSchema({ day: 'string', planHash: 'string' }, ['day', 'planHash']),
  ),
  queuedTool(
    'tempo_delete',
    'tempo.delete',
    'Identify the exact worklog to the user and get confirmation in this conversation. Use the day and ID from tempo_worklogs and ask the user to approve this request individually in the app.',
    inputSchema({ day: 'string', worklogId: 'string' }, ['day', 'worklogId']),
  ),
  {
    name: 'calendar_events',
    description:
      'Read events from the app’s watched Google calendars (YYYY-MM-DD, inclusive, up to 92 days). Exclude declined and all-day events when totaling meeting time.',
    inputSchema: inputSchema({ from: 'string', to: 'string' }, ['from', 'to']),
    run: forward('calendar.events'),
  },
  {
    name: 'settings_rules',
    description:
      'Explain how a band was named using attribution rules, project links, background projects and ruled applications. Background projects take time unclaimed by other bands.',
    inputSchema: inputSchema(),
    run: forward('settings.rules'),
  },
  queuedTool(
    'rules_repoint',
    'rules.repoint',
    'Point every attribution rule that names issue `from` at issue `to`, optionally only for one checkout.',
    inputSchema({ from: 'string', to: 'string', repoPath: 'string' }, ['from', 'to']),
  ),
  {
    name: 'agent_sessions_resync',
    description:
      'Re-read agent session logs for checkouts after linking them to a project. Set replace to overwrite the stored logs, for example after a parser fix. Queues the read for human approval and returns its approval ID.',
    inputSchema: inputSchema({ paths: 'strings', replace: 'boolean' }, ['paths']),
    run: ({ paths, replace }) => queue('agentSessions.resync')(replace === true ? { paths, replace } : { paths }),
  },
  {
    name: 'standin_list',
    description: 'List stand-ins and their time across days. Open stand-ins collect time without booking it in Tempo.',
    inputSchema: inputSchema(),
    run: forward('standIn.list'),
  },
  queuedTool(
    'standin_remove',
    'standIn.remove',
    'Delete one stand-in. If past days will lose its attribution, name those days and confirm with the user before queuing.',
    inputSchema({ id: 'string' }, ['id']),
  ),
  queuedTool(
    'standin_rename',
    'standIn.rename',
    'Give one stand-in another name.',
    inputSchema({ id: 'string', name: 'string' }, ['id', 'name']),
  ),
  queuedTool(
    'standin_merge',
    'standIn.merge',
    'Merge one open stand-in into another.',
    inputSchema({ id: 'string', into: 'string' }, ['id', 'into']),
  ),
  queuedTool(
    'standin_resolve',
    'standIn.resolve',
    'Point all days of a stand-in at the Jira issue the user asks for. Existing Tempo worklogs keep their issue.',
    inputSchema({ id: 'string', issueKey: 'string' }, ['id', 'issueKey']),
  ),
  {
    name: 'standin_split_plan',
    description:
      'Preview splitting a checkout-wide stand-in by directory. Supply commits as {day,paths} for the checkout’s git user.email unless the user specifies an author. Use checkout-relative projectRoots and paths to pick the pieces. Set claim to assign days without a commit to one piece.',
    inputSchema: inputSchema(
      {
        id: 'string',
        branch: 'string',
        commits: 'objects',
        repoPath: 'string',
        projectRoots: 'strings',
        paths: 'strings',
        claim: 'string',
      },
      ['id', 'branch', 'commits', 'projectRoots', 'paths'],
    ),
    run: forward('standIn.split', {}, { apply: false }),
  },
  queuedTool(
    'standin_split_apply',
    'standIn.split',
    'Apply the cut standin_split_plan planned, with the same arguments.',
    inputSchema(
      {
        id: 'string',
        branch: 'string',
        commits: 'objects',
        repoPath: 'string',
        projectRoots: 'strings',
        paths: 'strings',
        claim: 'string',
      },
      ['id', 'branch', 'commits', 'projectRoots', 'paths'],
    ),
    { apply: true },
  ),
  {
    name: 'lane_issues',
    description: 'Read what each lane of the day screen was named with before.',
    inputSchema: inputSchema(),
    run: forward('lane.issues'),
  },
  {
    name: 'auto_mode_ask',
    description:
      'Ask auto mode again about an open stand-in present on the day or an unnamed band. Use the standInId or contextId in day_rows autoModeSubject. The new answer replaces the stored one and its proposals wait for approval.',
    inputSchema: inputSchema({ day: 'string', standInId: 'string', contextId: 'string' }, ['day']),
    run: forward('autoMode.ask'),
  },
];

const matchesType = (value: unknown, type: FieldSchema['type']) => {
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'object') return objectOf(value) !== undefined;
  if (type === 'array') return Array.isArray(value);

  return typeof value === type;
};

const matchesField = (value: unknown, { type, items }: FieldSchema) =>
  matchesType(value, type) && (!items || (value as unknown[]).every((item) => matchesType(item, items.type)));

const describeField = ({ type, items }: FieldSchema) => (items ? `array of ${items.type}` : type);

const validateArguments = (args: Record<string, unknown>, schema: InputSchema) => {
  for (const name of schema.required) {
    if (!Object.hasOwn(args, name)) throw new Error(`Missing argument "${name}".`);
  }

  for (const [name, value] of Object.entries(args)) {
    const field = Object.hasOwn(schema.properties, name) ? schema.properties[name] : undefined;
    if (!field) throw new Error(`Unknown argument "${name}".`);

    if (!matchesField(value, field)) throw new Error(`Argument "${name}" must have type ${describeField(field)}.`);
  }
};

const callTool = async (tool: Tool, input: unknown) => {
  try {
    const args = input === undefined ? {} : objectOf(input);
    if (!args) throw new Error('Tool arguments must be an object.');

    validateArguments(args, tool.inputSchema);
    const value = await tool.run(args);

    return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text }], isError: true };
  }
};

const rpcError = (id: string | number | null, code: number, message: string) => ({
  jsonrpc: '2.0',
  id,
  error: { code, message },
});

export const answerMcp = async (input: unknown) => {
  const request = objectOf(input);
  const id = request?.['id'];
  const method = request?.['method'];
  const responseId = typeof id === 'number' || typeof id === 'string' ? id : null;

  if (request?.['jsonrpc'] !== '2.0' || typeof method !== 'string' || (id !== undefined && responseId === null)) {
    return rpcError(responseId, -32600, 'Invalid JSON-RPC request.');
  }
  if (id === undefined) return null;

  const params = objectOf(request['params']);
  const answer = (result: unknown) => ({ jsonrpc: '2.0', id, result });

  switch (method) {
    case 'initialize':
      return answer({
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'timetrack-mcp', version: '0.1.0' },
        instructions: SERVER_INSTRUCTIONS,
      });
    case 'ping':
      return answer({});
    case 'tools/list':
      return answer({ tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call': {
      const tool = tools.find(({ name }) => name === params?.['name']);
      if (!tool) return rpcError(responseId, -32602, 'Unknown Timetrack tool.');

      return answer(await callTool(tool, params?.['arguments']));
    }
    default:
      return rpcError(responseId, -32601, 'Unknown JSON-RPC method.');
  }
};

export const answerMcpLine = async (line: string) => {
  let request: unknown;

  try {
    request = JSON.parse(line);
  } catch {
    return rpcError(null, -32700, 'Invalid JSON.');
  }

  return answerMcp(request);
};
