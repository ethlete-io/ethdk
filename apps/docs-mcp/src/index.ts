import { onRequest } from 'firebase-functions/v2/https';
import { DocsIndex, parseDocsIndex } from './docs-index';
import { handleMcpRequest } from './protocol';

/**
 * Hosts the docs site is allowed to be read from. The index URL is derived from the incoming
 * `Host` header so one deployment serves whichever docs site proxied the request - but the
 * header is attacker-controllable, so it is checked against this list before it becomes a fetch.
 */
const DOCS_HOSTS = new Set([
  'ethlete-sdk-docs.web.app',
  'ethlete-sdk-docs.firebaseapp.com',
  'ethlete-sdk-docs-next.web.app',
  'ethlete-sdk-docs-next.firebaseapp.com',
]);

const FALLBACK_DOCS_ORIGIN = 'https://ethlete-sdk-docs.web.app';

const DEFAULT_ALLOWED_ORIGINS = ['https://claude.ai', 'https://claude.com', 'https://cursor.com'];

const LOCALHOST_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

/** Docs are rebuilt per deploy, so a warm instance may hold a stale index for up to this long. */
const INDEX_TTL_MS = 10 * 60 * 1000;

const SERVER_INFO = { name: 'ethlete-sdk-docs', version: '1.0.0' };

type CacheEntry = {
  loadedAt: number;
  index: Promise<DocsIndex>;
};

const cache = new Map<string, CacheEntry>();

const allowedOrigins = (): string[] => {
  const configured = process.env['MCP_ALLOWED_ORIGINS'];
  const extra = configured
    ? configured
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

  return [...DEFAULT_ALLOWED_ORIGINS, ...[...DOCS_HOSTS].map((host) => `https://${host}`), ...extra];
};

const isAllowedOrigin = (origin: string) => LOCALHOST_ORIGIN.test(origin) || allowedOrigins().includes(origin);

const docsOrigin = (host: string | undefined) => {
  const configured = process.env['DOCS_ORIGIN'];

  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const bare = host?.split(':')[0]?.toLowerCase();

  return bare && DOCS_HOSTS.has(bare) ? `https://${bare}` : FALLBACK_DOCS_ORIGIN;
};

const fetchIndex = async (origin: string): Promise<DocsIndex> => {
  const response = await fetch(`${origin}/llms-full.txt`);

  if (!response.ok) {
    throw new Error(`${origin}/llms-full.txt responded ${response.status}`);
  }

  return parseDocsIndex(await response.text());
};

const loadIndex = (origin: string): Promise<DocsIndex> => {
  const cached = cache.get(origin);

  if (cached && Date.now() - cached.loadedAt < INDEX_TTL_MS) {
    return cached.index;
  }

  const entry: CacheEntry = { loadedAt: Date.now(), index: fetchIndex(origin) };

  cache.set(origin, entry);

  // A failed fetch must not be cached, or the instance stays broken until its TTL expires.
  entry.index.catch(() => {
    if (cache.get(origin) === entry) {
      cache.delete(origin);
    }
  });

  return entry.index;
};

const handler = onRequest(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 60, maxInstances: 10, invoker: 'public', cors: false },
  async (request, response) => {
    const origin = docsOrigin(request.headers.host);

    const result = await handleMcpRequest(
      { method: request.method, headers: request.headers, body: request.body },
      { loadIndex: () => loadIndex(origin), serverInfo: SERVER_INFO, isAllowedOrigin },
    );

    for (const [name, value] of Object.entries(result.headers)) {
      response.setHeader(name, value);
    }

    if (result.body === undefined) {
      response.status(result.status).end();

      return;
    }

    response.status(result.status).json(result.body);
  },
);

/** Rewritten from `/mcp` on the production docs site. */
export const docsMcp = handler;

/** Rewritten from `/mcp` on the `next` docs site. */
export const docsMcpNext = handler;
