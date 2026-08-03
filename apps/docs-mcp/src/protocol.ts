/**
 * Streamable HTTP MCP endpoint, stateless.
 *
 * Revision `2026-07-28` dropped the `initialize` handshake, protocol-level sessions
 * (`Mcp-Session-Id`) and the standalone GET/SSE stream, so a single JSON request/response per
 * POST covers everything this server does - no session store, no long-lived connections.
 * Older clients that still open with `initialize` are answered too; see PROTOCOL_VERSIONS.
 *
 * Every tool here returns a complete result in one shot, so responses are always
 * `application/json`; the SSE branch of the transport is never needed.
 */

import { DocsIndex } from './docs-index';
import { callTool, TOOL_DEFINITIONS } from './tools';

/** Newest first. Anything newer than the first entry is served as that entry. */
export const PROTOCOL_VERSIONS = ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26'] as const;

const LATEST_PROTOCOL_VERSION = PROTOCOL_VERSIONS[0];

/** From this revision on, requests carry their metadata in headers and must be validated. */
const HEADER_METADATA_SINCE = '2026-07-28';

/** Assumed when a client sends no `MCP-Protocol-Version`, per the transport spec. */
const ASSUMED_LEGACY_VERSION = '2025-03-26';

const PROTOCOL_VERSION_META = 'io.modelcontextprotocol/protocolVersion';

const JSON_RPC_ERRORS = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
  headerMismatch: -32020,
} as const;

const BASE64_SENTINEL = /^=\?base64\?(.*)\?=$/;

export type HttpRequestLike = {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
};

export type HttpResponseLike = {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
};

export type McpServerInfo = {
  name: string;
  version: string;
};

export type McpHandlerDeps = {
  loadIndex: () => Promise<DocsIndex>;
  serverInfo: McpServerInfo;
  isAllowedOrigin: (origin: string) => boolean;
};

type JsonRpcRequest = {
  jsonrpc: string;
  id?: string | number | null;
  method?: unknown;
  params?: unknown;
};

const header = (request: HttpRequestLike, name: string): string | undefined => {
  const value = request.headers[name.toLowerCase()];

  return Array.isArray(value) ? value[0] : value;
};

/**
 * Header values that cannot be expressed in plain ASCII arrive Base64-wrapped in a
 * `=?base64?…?=` sentinel and must be decoded before they are compared to the body.
 */
export const decodeHeaderValue = (value: string) => {
  const match = BASE64_SENTINEL.exec(value);

  return match?.[1] === undefined ? value : Buffer.from(match[1], 'base64').toString('utf8');
};

const corsHeaders = (origin: string | undefined, allowed: boolean): Record<string, string> => {
  if (!origin || !allowed) {
    return {};
  }

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers':
      'content-type, accept, authorization, mcp-protocol-version, mcp-method, mcp-name, mcp-param-*',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
};

const jsonResponse = (
  status: number,
  { body, headers = {} }: { body: unknown; headers?: Record<string, string> },
): HttpResponseLike => ({
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  body,
});

const errorResponse = (
  status: number,
  {
    id,
    code,
    message,
    headers = {},
  }: { id: string | number | null; code: number; message: string; headers?: Record<string, string> },
): HttpResponseLike => jsonResponse(status, { body: { jsonrpc: '2.0', id, error: { code, message } }, headers });

const negotiateVersion = (requested: string | undefined) => {
  if (!requested) {
    return ASSUMED_LEGACY_VERSION;
  }

  if ((PROTOCOL_VERSIONS as readonly string[]).includes(requested)) {
    return requested;
  }

  // A version we do not know: newer ones behave like the latest we implement, older ones like
  // the pre-header era. Being lenient keeps a read-only docs server usable from any client.
  return requested > LATEST_PROTOCOL_VERSION ? LATEST_PROTOCOL_VERSION : ASSUMED_LEGACY_VERSION;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/**
 * Verifies the mirrored `Mcp-*` headers against the body. Intermediaries route on the headers
 * while the server acts on the body, so a mismatch between the two must be rejected rather
 * than silently resolved in favour of either side.
 */
const validateMirroredHeaders = (
  request: HttpRequestLike,
  { method, params }: { method: string; params: Record<string, unknown> },
): string | null => {
  const declaredMethod = header(request, 'mcp-method');

  if (!declaredMethod) {
    return 'Missing required Mcp-Method header.';
  }

  if (declaredMethod !== method) {
    return `Header mismatch: Mcp-Method header value '${declaredMethod}' does not match body value '${method}'.`;
  }

  const needsName = method === 'tools/call' || method === 'resources/read' || method === 'prompts/get';

  if (!needsName) {
    return null;
  }

  const expected = typeof params['name'] === 'string' ? params['name'] : params['uri'];

  if (typeof expected !== 'string') {
    return null;
  }

  const declaredName = header(request, 'mcp-name');

  if (!declaredName) {
    return 'Missing required Mcp-Name header.';
  }

  if (decodeHeaderValue(declaredName) !== expected) {
    return `Header mismatch: Mcp-Name header value '${declaredName}' does not match body value '${expected}'.`;
  }

  return null;
};

const dispatch = async (
  deps: McpHandlerDeps,
  { method, params, protocolVersion }: { method: string; params: Record<string, unknown>; protocolVersion: string },
): Promise<{ result: unknown } | { code: number; message: string }> => {
  switch (method) {
    case 'initialize':
      return {
        result: {
          protocolVersion: negotiateVersion(
            typeof params['protocolVersion'] === 'string' ? params['protocolVersion'] : protocolVersion,
          ),
          capabilities: { tools: { listChanged: false } },
          serverInfo: deps.serverInfo,
          instructions:
            'Documentation for the Ethlete SDK (@ethlete/*). Search with search_docs, then read a page with get_doc.',
        },
      };
    case 'ping':
      return { result: {} };
    case 'tools/list':
      return { result: { tools: TOOL_DEFINITIONS } };
    case 'tools/call': {
      const name = params['name'];

      if (typeof name !== 'string') {
        return { code: JSON_RPC_ERRORS.invalidParams, message: 'tools/call requires a string `name`.' };
      }

      return { result: callTool(await deps.loadIndex(), { name, args: asRecord(params['arguments']) }) };
    }
    default:
      return { code: JSON_RPC_ERRORS.methodNotFound, message: `Method not found: ${method}` };
  }
};

export const handleMcpRequest = async (request: HttpRequestLike, deps: McpHandlerDeps): Promise<HttpResponseLike> => {
  const origin = header(request, 'origin');
  const originAllowed = !origin || deps.isAllowedOrigin(origin);
  const cors = corsHeaders(origin, originAllowed);

  // DNS-rebinding protection: an Origin that is present but not allowlisted is rejected
  // outright rather than merely denied CORS headers.
  if (origin && !originAllowed) {
    return errorResponse(403, {
      id: null,
      code: JSON_RPC_ERRORS.invalidRequest,
      message: `Origin '${origin}' is not allowed.`,
    });
  }

  if (request.method === 'OPTIONS') {
    return { status: 204, headers: cors };
  }

  // GET and DELETE were the session/SSE mechanics of earlier revisions; this server has neither.
  if (request.method !== 'POST') {
    return { status: 405, headers: { allow: 'POST, OPTIONS', ...cors } };
  }

  const body = request.body;

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return errorResponse(400, {
      id: null,
      code: JSON_RPC_ERRORS.parse,
      message: 'Request body must be a single JSON-RPC object.',
      headers: cors,
    });
  }

  const rpc = body as JsonRpcRequest;
  const id = rpc.id ?? null;
  const method = rpc.method;

  if (rpc.jsonrpc !== '2.0' || typeof method !== 'string') {
    return errorResponse(400, {
      id,
      code: JSON_RPC_ERRORS.invalidRequest,
      message: 'Expected a JSON-RPC 2.0 request with a string method.',
      headers: cors,
    });
  }

  const params = asRecord(rpc.params);
  const meta = asRecord(params['_meta']);
  const headerVersion = header(request, 'mcp-protocol-version');
  const bodyVersion =
    typeof meta[PROTOCOL_VERSION_META] === 'string' ? (meta[PROTOCOL_VERSION_META] as string) : undefined;

  if (headerVersion && bodyVersion && headerVersion !== bodyVersion) {
    return errorResponse(400, {
      id,
      code: JSON_RPC_ERRORS.headerMismatch,
      message: `Header mismatch: MCP-Protocol-Version header value '${headerVersion}' does not match body value '${bodyVersion}'.`,
      headers: cors,
    });
  }

  const protocolVersion = negotiateVersion(headerVersion ?? bodyVersion);

  if (protocolVersion >= HEADER_METADATA_SINCE) {
    const problem = validateMirroredHeaders(request, { method, params });

    if (problem) {
      return errorResponse(400, { id, code: JSON_RPC_ERRORS.headerMismatch, message: problem, headers: cors });
    }
  }

  // A notification carries no id and gets no body back.
  const isNotification = rpc.id === undefined || rpc.id === null;

  if (isNotification) {
    return method.startsWith('notifications/')
      ? { status: 202, headers: cors }
      : errorResponse(400, {
          id: null,
          code: JSON_RPC_ERRORS.invalidRequest,
          message: `Request '${method}' requires an id.`,
          headers: cors,
        });
  }

  try {
    const outcome = await dispatch(deps, { method, params, protocolVersion });

    if ('result' in outcome) {
      return jsonResponse(200, { body: { jsonrpc: '2.0', id, result: outcome.result }, headers: cors });
    }

    // An unimplemented method answers 404 so a client can tell it apart from a legacy server.
    const status = outcome.code === JSON_RPC_ERRORS.methodNotFound ? 404 : 400;

    return errorResponse(status, { id, code: outcome.code, message: outcome.message, headers: cors });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return errorResponse(500, {
      id,
      code: JSON_RPC_ERRORS.internal,
      message: `Failed to handle ${method}: ${message}`,
      headers: cors,
    });
  }
};
