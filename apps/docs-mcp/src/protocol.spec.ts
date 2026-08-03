import { describe, expect, it } from 'vitest';
import { DocsIndex, parseDocsIndex } from './docs-index';
import { decodeHeaderValue, handleMcpRequest, HttpRequestLike, McpHandlerDeps } from './protocol';

const FIXTURE = `---\nurl: /components/button.md\n---\n# Button\n\nThe button renders a clickable control.\n\n## Sizes\n\nSet \`data-size\`.\n`;

const index: DocsIndex = parseDocsIndex(FIXTURE);

const deps: McpHandlerDeps = {
  loadIndex: () => Promise.resolve(index),
  serverInfo: { name: 'test', version: '0.0.0' },
  isAllowedOrigin: (origin) => origin === 'https://claude.ai',
};

const MODERN = '2026-07-28';

const post = (body: unknown, headers: Record<string, string> = {}): HttpRequestLike => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body,
});

const rpc = (method: string, params?: Record<string, unknown>, id: number | string = 1) => ({
  jsonrpc: '2.0',
  id,
  method,
  ...(params ? { params } : {}),
});

const modernHeaders = (method: string, name?: string) => ({
  'mcp-protocol-version': MODERN,
  'mcp-method': method,
  ...(name ? { 'mcp-name': name } : {}),
});

const resultOf = (response: { body?: unknown }) => (response.body as { result?: Record<string, unknown> }).result;
const errorOf = (response: { body?: unknown }) =>
  (response.body as { error?: { code: number; message: string } }).error;
const firstText = (response: { body?: unknown }): string => {
  const content = (resultOf(response) as { content?: { text: string }[] } | undefined)?.content;

  return content?.[0]?.text ?? '';
};

describe('transport', () => {
  it('rejects GET with 405 — sessions and the standalone SSE stream do not exist here', async () => {
    const response = await handleMcpRequest({ method: 'GET', headers: {}, body: undefined }, deps);

    expect(response.status).toBe(405);
    expect(response.headers['allow']).toBe('POST, OPTIONS');
  });

  it('answers preflight with CORS headers for an allowed origin', async () => {
    const response = await handleMcpRequest(
      { method: 'OPTIONS', headers: { origin: 'https://claude.ai' }, body: undefined },
      deps,
    );

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://claude.ai');
  });

  it('rejects a disallowed origin with 403', async () => {
    const response = await handleMcpRequest(post(rpc('tools/list'), { origin: 'https://evil.example' }), deps);

    expect(response.status).toBe(403);
  });

  it('serves a request with no origin at all', async () => {
    const response = await handleMcpRequest(post(rpc('tools/list'), modernHeaders('tools/list')), deps);

    expect(response.status).toBe(200);
  });

  it('returns 202 with no body for a notification', async () => {
    const response = await handleMcpRequest(
      post({ jsonrpc: '2.0', method: 'notifications/initialized' }, { 'mcp-method': 'notifications/initialized' }),
      deps,
    );

    expect(response.status).toBe(202);
    expect(response.body).toBeUndefined();
  });

  it('rejects a non-object body', async () => {
    const response = await handleMcpRequest(post('not json-rpc'), deps);

    expect(response.status).toBe(400);
    expect(errorOf(response)?.code).toBe(-32700);
  });

  it('answers an unknown method with 404 and -32601', async () => {
    const response = await handleMcpRequest(post(rpc('resources/list'), modernHeaders('resources/list')), deps);

    expect(response.status).toBe(404);
    expect(errorOf(response)?.code).toBe(-32601);
  });
});

describe('mirrored header validation', () => {
  it('rejects a missing Mcp-Method on a modern request', async () => {
    const response = await handleMcpRequest(post(rpc('tools/list'), { 'mcp-protocol-version': MODERN }), deps);

    expect(response.status).toBe(400);
    expect(errorOf(response)?.code).toBe(-32020);
  });

  it('rejects an Mcp-Method that disagrees with the body', async () => {
    const response = await handleMcpRequest(post(rpc('tools/list'), modernHeaders('tools/call')), deps);

    expect(errorOf(response)?.code).toBe(-32020);
  });

  it('rejects an Mcp-Name that disagrees with the body', async () => {
    const response = await handleMcpRequest(
      post(
        rpc('tools/call', { name: 'search_docs', arguments: { query: 'x' } }),
        modernHeaders('tools/call', 'get_doc'),
      ),
      deps,
    );

    expect(errorOf(response)?.code).toBe(-32020);
  });

  it('accepts a Base64-wrapped Mcp-Name', async () => {
    const encoded = `=?base64?${Buffer.from('search_docs', 'utf8').toString('base64')}?=`;
    const response = await handleMcpRequest(
      post(
        rpc('tools/call', { name: 'search_docs', arguments: { query: 'button' } }),
        modernHeaders('tools/call', encoded),
      ),
      deps,
    );

    expect(response.status).toBe(200);
  });

  it('rejects a protocol version header that disagrees with the body', async () => {
    const response = await handleMcpRequest(
      post(
        rpc('tools/list', { _meta: { 'io.modelcontextprotocol/protocolVersion': '2025-06-18' } }),
        modernHeaders('tools/list'),
      ),
      deps,
    );

    expect(errorOf(response)?.code).toBe(-32020);
  });

  it('does not require mirrored headers from a pre-2026 client', async () => {
    const response = await handleMcpRequest(post(rpc('tools/list')), deps);

    expect(response.status).toBe(200);
  });

  it('decodes the Base64 sentinel and leaves plain values alone', () => {
    expect(decodeHeaderValue('=?base64?aGVsbG8=?=')).toBe('hello');
    expect(decodeHeaderValue('plain')).toBe('plain');
  });
});

describe('initialize', () => {
  it('echoes a supported version and advertises tools', async () => {
    const response = await handleMcpRequest(post(rpc('initialize', { protocolVersion: '2025-06-18' })), deps);
    const result = resultOf(response);

    expect(result?.['protocolVersion']).toBe('2025-06-18');
    expect(result?.['capabilities']).toEqual({ tools: { listChanged: false } });
    expect(result?.['serverInfo']).toEqual({ name: 'test', version: '0.0.0' });
  });

  it('negotiates an unknown future version down to the latest implemented one', async () => {
    const response = await handleMcpRequest(post(rpc('initialize', { protocolVersion: '2099-01-01' })), deps);

    expect(resultOf(response)?.['protocolVersion']).toBe(MODERN);
  });

  it('never mints a session id', async () => {
    const response = await handleMcpRequest(post(rpc('initialize', { protocolVersion: MODERN })), deps);

    expect(Object.keys(response.headers)).not.toContain('mcp-session-id');
  });
});

describe('tools', () => {
  it('lists the three docs tools with schemas', async () => {
    const response = await handleMcpRequest(post(rpc('tools/list'), modernHeaders('tools/list')), deps);
    const tools = resultOf(response)?.['tools'] as { name: string; inputSchema: unknown }[];

    expect(tools.map((tool) => tool.name)).toEqual(['search_docs', 'get_doc', 'list_docs']);
    expect(tools[0]?.inputSchema).toBeTypeOf('object');
  });

  it('searches and returns a path an agent can pass back to get_doc', async () => {
    const response = await handleMcpRequest(
      post(
        rpc('tools/call', { name: 'search_docs', arguments: { query: 'clickable control' } }),
        modernHeaders('tools/call', 'search_docs'),
      ),
      deps,
    );

    expect(firstText(response)).toContain('/components/button');
  });

  it('returns the page markdown for get_doc', async () => {
    const response = await handleMcpRequest(
      post(
        rpc('tools/call', { name: 'get_doc', arguments: { path: 'components/button.md' } }),
        modernHeaders('tools/call', 'get_doc'),
      ),
      deps,
    );

    expect(firstText(response)).toContain('The button renders a clickable control.');
  });

  it('returns a single section when asked for one', async () => {
    const response = await handleMcpRequest(
      post(
        rpc('tools/call', { name: 'get_doc', arguments: { path: '/components/button', section: 'Sizes' } }),
        modernHeaders('tools/call', 'get_doc'),
      ),
      deps,
    );
    const text = firstText(response);

    expect(text).toContain('data-size');
    expect(text).not.toContain('clickable control');
  });

  it('reports an unknown path as a tool error with suggestions', async () => {
    const response = await handleMcpRequest(
      post(
        rpc('tools/call', { name: 'get_doc', arguments: { path: '/components/buttons' } }),
        modernHeaders('tools/call', 'get_doc'),
      ),
      deps,
    );

    expect((resultOf(response) as { isError?: boolean }).isError).toBe(true);
    expect(firstText(response)).toContain('/components/button');
  });

  it('lists pages grouped by library', async () => {
    const response = await handleMcpRequest(
      post(rpc('tools/call', { name: 'list_docs', arguments: {} }), modernHeaders('tools/call', 'list_docs')),
      deps,
    );

    expect(firstText(response)).toContain('/components/button — Button');
  });

  it('surfaces an index load failure as a JSON-RPC internal error', async () => {
    const response = await handleMcpRequest(post(rpc('tools/list'), modernHeaders('tools/list')), {
      ...deps,
      loadIndex: () => Promise.reject(new Error('llms-full.txt responded 503')),
    });

    // tools/list does not touch the index, so force the failure through a call instead.
    expect(response.status).toBe(200);

    const failed = await handleMcpRequest(
      post(rpc('tools/call', { name: 'list_docs', arguments: {} }), modernHeaders('tools/call', 'list_docs')),
      { ...deps, loadIndex: () => Promise.reject(new Error('llms-full.txt responded 503')) },
    );

    expect(failed.status).toBe(500);
    expect(errorOf(failed)?.code).toBe(-32603);
  });
});
