import { createHmac } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentApiApprovalStatus, AgentApiQueued } from '../agent-api/approval-queue';
import { AGENT_CONTRACT_V3, AGENT_CONTRACT_V3_OPS } from '../agent-api/contract-v3';
import type { AgentApiAnswer, AgentApiInstance, AgentApiIssue, AgentApiStatus } from '../agent-api/model';
import { AGENT_API_OP_CLASSES } from '../agent-api/model';
import { answerMcp } from './server.mts';

const token = 'fake-timetrack-token';
const status = {
  version: 1,
  jiraReady: true,
  tempoReady: false,
  projects: [],
  subjectField: '',
} satisfies AgentApiStatus;
const instance = {
  levels: [],
  suggestedParenting: 'parent-field',
  subjectFieldCandidates: [],
} satisfies AgentApiInstance;
const issue = {
  key: 'ABC-1',
  id: '123',
  summary: 'Export PDFs',
  issueType: 'Task',
  parentKey: 'ABC-2',
} satisfies AgentApiIssue;
const queued = { status: 'queued', approvalId: 'a1' } satisfies AgentApiQueued;
const approved = {
  status: 'approved',
  approvalId: 'a1',
  result: { key: 'ABC-3', id: '125' },
} satisfies AgentApiApprovalStatus;

const call = (name: string, args: Record<string, unknown> = {}) =>
  answerMcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

const success = (value: unknown) => ({ ok: true, value }) satisfies AgentApiAnswer;

describe('Timetrack agent MCP v3 contract', () => {
  let directory: string;
  let discovery: string;
  let port: number;
  let appAnswer: AgentApiAnswer;
  let badProof: boolean;
  let posted: unknown[];
  let nonces: string[];
  let server: ReturnType<typeof createServer>;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'timetrack-mcp-'));
    discovery = join(directory, 'agent.json');
    appAnswer = success(status);
    badProof = false;
    posted = [];
    nonces = [];

    server = createServer(async (request, reply) => {
      const send = (statusCode: number, body?: AgentApiAnswer) => {
        reply.writeHead(statusCode, { 'content-type': 'application/json', connection: 'close' });
        reply.end(body && JSON.stringify(body));
      };

      if (request.headers.origin !== undefined) return send(403);

      const proof = /^\/agent\/proof\?nonce=([a-fA-F0-9]{16,128})$/.exec(request.url ?? '');

      const nonce = proof?.[1];

      if (nonce) {
        if (request.method !== 'GET') return send(405);

        nonces.push(nonce);

        // The adapter must prove the server before sharing the token.
        if (request.headers.authorization !== undefined) return send(400);

        const signature = createHmac('sha256', badProof ? 'other-token' : token)
          .update(nonce)
          .digest('hex');

        return send(200, success({ proof: signature }));
      }

      if (request.headers.authorization !== `Bearer ${token}`) return send(401);
      if (request.url !== '/agent') return send(404);
      if (request.method !== 'POST') return send(405);
      if (request.headers['content-type'] !== 'application/json') return send(400);

      let body = '';
      request.setEncoding('utf8');
      for await (const chunk of request) body += chunk;

      posted.push(JSON.parse(body));
      send(200, appAnswer);
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a loopback address');

    port = address.port;
    await writeFile(discovery, JSON.stringify({ version: 3, port, token }), { mode: 0o600 });
    vi.stubEnv('TIMETRACK_AGENT_DISCOVERY', discovery);
    vi.stubEnv('TIMETRACK_CLIENT', 'Contract spec');
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  });

  const reads = AGENT_CONTRACT_V3.filter(({ queues }) => !queues);
  const writes = AGENT_CONTRACT_V3.filter(({ queues }) => queues);

  it('serves every v3 op through exactly one tool', () => {
    expect(AGENT_CONTRACT_V3.map(({ tool }) => tool)).toEqual([...new Set(AGENT_CONTRACT_V3.map(({ tool }) => tool))]);
    expect([...AGENT_CONTRACT_V3_OPS].sort()).toEqual(Object.keys(AGENT_API_OP_CLASSES).sort());
  });

  it.each(AGENT_CONTRACT_V3.map((entry) => [entry.tool, entry] as const))(
    'pins the %s request',
    async (_name, { tool, args, request, wire, queues }) => {
      const value = queues ? queued : { echoed: tool };
      appAnswer = success(value);

      expect(await call(tool, args)).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value },
      });
      expect(posted).toEqual([{ ...(wire ?? request), client: 'Contract spec' }]);
      expect(nonces).toHaveLength(1);
    },
  );

  it.each([
    ['status', status],
    ['jira_instance', instance],
    ['jira_issue', { issue }],
    ['approval_status', approved],
  ])('returns the %s response untouched', async (name, value) => {
    appAnswer = success(value);

    expect(
      await call(name, name === 'jira_issue' ? { key: 'ABC-1' } : name === 'approval_status' ? { id: 'a1' } : {}),
    ).toMatchObject({
      result: { structuredContent: value },
    });
  });

  it('queues the jira_create defaults the app expects', async () => {
    appAnswer = success(queued);

    await call('jira_create', { summary: 'Export PDFs' });

    expect(posted).toEqual([{ op: 'jira.create', summary: 'Export PDFs', description: '', client: 'Contract spec' }]);
  });

  it.each(writes.map((entry) => [entry.tool, entry] as const))(
    'never lets %s report an applied change',
    async (_name, { tool, args }) => {
      appAnswer = success({ status: 'applied', key: 'ABC-3', id: '125' });

      expect(await call(tool, args)).toMatchObject({
        result: { isError: true, content: [{ type: 'text', text: expect.stringContaining('approval receipt') }] },
      });
    },
  );

  it('never lets a write tool take an answer without an approval id', async () => {
    appAnswer = success({ status: 'queued' });

    for (const { tool, args } of writes) {
      expect(await call(tool, args)).toMatchObject({ result: { isError: true } });
    }
  });

  it('leaves reads free of the approval receipt check', async () => {
    appAnswer = success({ status: 'applied' });

    for (const { tool, args } of reads) {
      expect(await call(tool, args)).toMatchObject({ result: { structuredContent: { status: 'applied' } } });
    }
  });

  it('refuses a different discovery version before making any request', async () => {
    await writeFile(discovery, JSON.stringify({ version: 2, port, token }));

    expect(await call('status')).toMatchObject({
      result: { isError: true, content: [{ type: 'text', text: expect.stringContaining('version 2') }] },
    });
    expect(nonces).toEqual([]);
    expect(posted).toEqual([]);
  });

  it('refuses the wrong HMAC before posting any data', async () => {
    badProof = true;

    expect(await call('status')).toMatchObject({
      result: { isError: true, content: [{ type: 'text', text: expect.stringContaining('proof') }] },
    });
    expect(nonces).toHaveLength(1);
    expect(posted).toEqual([]);
  });

  it('surfaces an operation failure returned with HTTP 200', async () => {
    appAnswer = { ok: false, message: 'Jira has no issue ABC-9.' };

    expect(await call('jira_issue', { key: 'ABC-9' })).toMatchObject({
      result: { isError: true, content: [{ type: 'text', text: 'Jira has no issue ABC-9.' }] },
    });
    expect(posted).toEqual([{ op: 'jira.issue', key: 'ABC-9', client: 'Contract spec' }]);
  });

  it('initializes with approval instructions and exposes one tool per v3 op', async () => {
    expect(await answerMcp({ jsonrpc: '2.0', id: 0, method: 'initialize' })).toMatchObject({
      jsonrpc: '2.0',
      id: 0,
      result: {
        protocolVersion: '2025-06-18',
        serverInfo: { name: 'timetrack-mcp' },
        capabilities: { tools: {} },
        instructions: expect.stringMatching(/human approves writes in the Timetrack app.*approval_status/s),
      },
    });
    const listing = await answerMcp({ jsonrpc: '2.0', id: 2, method: 'tools/list' });

    expect(listing).toMatchObject({
      result: {
        tools: AGENT_CONTRACT_V3.map(({ tool }) => ({ name: tool, inputSchema: { type: 'object' } })),
      },
    });
    expect(nonces).toEqual([]);
    expect(posted).toEqual([]);
  });

  it('rejects unexpected tool arguments before reaching the app', async () => {
    expect(await call('jira_create', { summary: 'Export PDFs', op: 'approval.reject' })).toMatchObject({
      result: { isError: true, content: [{ type: 'text', text: expect.stringContaining('Unknown argument') }] },
    });
    expect(nonces).toEqual([]);
    expect(posted).toEqual([]);
  });
});
