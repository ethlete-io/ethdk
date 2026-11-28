import type { AgentApiApprovalStatus, AgentApiQueued } from '../agent-api/approval-queue';
import type { AgentApiInstance, AgentApiIssue, AgentApiRequest, AgentApiStatus } from '../agent-api/model';
import { askTimetrack } from './client.mts';

const MCP_PROTOCOL_VERSION = '2025-06-18';
const SERVER_INSTRUCTIONS = [
  'Start the stdio server with node libs/timetrack/src/lib/agent-mcp/timetrack-mcp.mts from the repository root (Node 22.18+).',
  'The human approves writes in the Timetrack app. jira_create queues a request and returns its approvalId.',
  'Tell the human the request is queued. Once they have decided in the app, check approval_status with that id.',
].join('\n');

type FieldType = 'string' | 'boolean' | 'integer';
type InputSchema = {
  type: 'object';
  properties: Record<string, { type: FieldType }>;
  required: string[];
  additionalProperties: false;
};

type Tool = {
  name: string;
  description: string;
  inputSchema: InputSchema;
  run: (args: Record<string, unknown>) => Promise<object>;
};

const inputSchema = (fields: Record<string, FieldType> = {}, required: string[] = []): InputSchema => ({
  type: 'object',
  properties: Object.fromEntries(Object.entries(fields).map(([name, type]) => [name, { type }])),
  required,
  additionalProperties: false,
});

type ToolArguments<TOp extends AgentApiRequest['op']> = Omit<Extract<AgentApiRequest, { op: TOp }>, 'op'>;

const objectOf = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const queueIssue = async (args: Record<string, unknown>): Promise<AgentApiQueued> => {
  const fields = args as Partial<ToolArguments<'jira.create'>> & { summary: string };
  const receipt = objectOf(await askTimetrack<unknown>({ description: '', ...fields, op: 'jira.create' }));
  const approvalId = receipt?.['approvalId'];

  if (receipt?.['status'] !== 'queued' || typeof approvalId !== 'string' || !approvalId.trim()) {
    throw new Error('Timetrack did not return a queued approval receipt. Check the approval queue in the app.');
  }

  return { status: 'queued', approvalId };
};

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
    description: 'Read one Jira issue by key.',
    inputSchema: inputSchema({ key: 'string' }, ['key']),
    run: ({ key }) => askTimetrack<{ issue: AgentApiIssue }>({ op: 'jira.issue', key: key as string }),
  },
  {
    name: 'jira_search',
    description: 'Search Jira issues in the selected projects or in one specified project.',
    inputSchema: inputSchema({ text: 'string', projectKey: 'string', assignedToMe: 'boolean', limit: 'integer' }),
    run: (args) =>
      askTimetrack<{ issues: AgentApiIssue[] }>({
        text: '',
        assignedToMe: false,
        ...(args as Partial<ToolArguments<'jira.search'>>),
        op: 'jira.search',
      }),
  },
  {
    name: 'jira_create',
    description: 'Queue a Jira issue for human approval in Timetrack and return its approval ID.',
    inputSchema: inputSchema(
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
    run: queueIssue,
  },
  {
    name: 'approval_status',
    description: 'Read the outcome of a queued write by approval ID.',
    inputSchema: inputSchema({ id: 'string' }, ['id']),
    run: ({ id }) => askTimetrack<AgentApiApprovalStatus>({ op: 'approval.status', id: id as string }),
  },
];

const validateArguments = (args: Record<string, unknown>, schema: InputSchema) => {
  for (const name of schema.required) {
    if (!Object.hasOwn(args, name)) throw new Error(`Missing argument "${name}".`);
  }

  for (const [name, value] of Object.entries(args)) {
    const field = Object.hasOwn(schema.properties, name) ? schema.properties[name] : undefined;
    if (!field) throw new Error(`Unknown argument "${name}".`);

    const { type } = field;
    if (type === 'integer' ? !Number.isInteger(value) : typeof value !== type) {
      throw new Error(`Argument "${name}" must have type ${type}.`);
    }
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
