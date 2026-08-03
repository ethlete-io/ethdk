# docs-mcp

> **Not deployed yet.** The code builds and is covered by tests in CI, but nothing is live:
> `firebase.json` mentions neither the function nor the `/mcp` rewrites, and the deploy steps are
> gated behind a repository variable. See [Enabling it](#enabling-it).

The MCP endpoint for the documentation site. Once enabled it is served at `/mcp` on both docs
sites, which rewrite that path to a Cloud Function:

| Site                                   | Function      | Endpoint                                    |
| -------------------------------------- | ------------- | ------------------------------------------- |
| `ethlete-sdk-docs.web.app` (prod)      | `docsMcp`     | `https://ethlete-sdk-docs.web.app/mcp`      |
| `ethlete-sdk-docs-next.web.app` (next) | `docsMcpNext` | `https://ethlete-sdk-docs-next.web.app/mcp` |

Both names export the same handler. They exist separately so a `next` deploy can never replace the
function production is serving.

## Why a function and not static files

MCP's Streamable HTTP transport requires an endpoint that **accepts POST** and answers each
JSON-RPC request; Firebase Hosting serves static files over GET only. Revision `2026-07-28` made
the protocol stateless - no `initialize` handshake, no `Mcp-Session-Id`, no standalone SSE stream -
which is what makes a plain serverless function sufficient: no session store, no sticky routing,
no long-lived connections, and any instance can answer any request.

## How the index works

There is no build-time index and no database. On a cold start the function fetches
`llms-full.txt` from the site that proxied the request, parses it into pages and `##` sections, and
builds a BM25 index in memory (~1 MB of text, 94 pages, ~790 sections). A warm instance reuses it
for ten minutes.

The consequence worth knowing: **the function does not need to be redeployed when the docs
change.** A docs deploy replaces `llms-full.txt`, and the next index refresh picks it up.

The docs origin is derived from the incoming `Host` header so one handler serves both sites, but
that header is client-controlled, so it is checked against an allowlist (`DOCS_HOSTS` in
`src/index.ts`) before it becomes a fetch. Add any custom domain there.

## Layout

| File            | Contents                                                              |
| --------------- | --------------------------------------------------------------------- |
| `docs-index.ts` | Parsing `llms-full.txt`, sectioning, tokenizing, BM25 search - no I/O |
| `tools.ts`      | The three tool definitions and their handlers - no I/O                |
| `protocol.ts`   | Streamable HTTP + JSON-RPC dispatch, header validation, CORS - no I/O |
| `index.ts`      | The Cloud Function: fetch, cache, origin allowlist                    |

Only `index.ts` touches the network or `firebase-functions`, so the protocol and search layers are
covered by plain unit tests (`nx test docs-mcp`).

## Protocol support

Revision `2026-07-28` is the target. Requests declaring it must carry the mirrored `Mcp-Method`
and `Mcp-Name` headers, which are validated against the body (`-32020 HeaderMismatch` on a
mismatch). Clients on `2025-03-26` through `2025-11-25` still work: `initialize` is answered, no
session id is ever minted, and the mirrored headers are not required. An unknown future version is
served as the newest revision implemented here rather than rejected - a read-only docs server has
nothing to protect by being strict.

`GET` and `DELETE` return `405`; both were session/SSE mechanics that no longer exist.

## Enabling it

Four things, in this order:

1. **Enable the Blaze plan on the `ethlete-sdk` Firebase project.** Cloud Functions does not exist
   on Spark, so every deploy fails with a billing error until this is done.

2. **Declare the functions codebase** in `firebase.json`, as a sibling of `hosting`:

   ```json
   "functions": [{ "codebase": "docs-mcp", "source": "dist/apps/docs-mcp", "ignore": ["node_modules", ".git", "*.log"] }]
   ```

   `source` is a build output, so `nx build docs-mcp` has to have run before any `firebase deploy`
   in that working tree - including a hosting-only one.

3. **Set the repository variable `DEPLOY_DOCS_MCP` to `true`** (Settings → Secrets and variables →
   Actions → Variables). Both CI workflows gate the function deploy on it and skip it otherwise.

4. **Add the `/mcp` rewrite** to the `docs-prod` and `docs-next` hosting targets, ahead of the `**`
   catch-all:

   ```json
   { "source": "/mcp", "function": { "functionId": "docsMcp", "region": "us-central1" } }
   ```

   `docsMcp` for `docs-prod`, `docsMcpNext` for `docs-next`.

Steps 2 and 4 are deliberately uncommitted: they would name a function that does not exist yet, and
the function deploy has to land before hosting for the rewrite to resolve. Until then `firebase.json`
is untouched, so the existing docs and Storybook deploys behave exactly as before.

Once the endpoint is live, document it on the docs site - `apps/docs/index.md`, under "Using these
docs with LLMs".

Deploying by hand:

```bash
npx nx build docs-mcp
npx nx run docs-mcp:deploy --args="--fn=docs-mcp:docsMcpNext"
```

## Local development

There is no emulator wiring. The handler is a pure function of a request, so drive it directly:

```ts
import { parseDocsIndex } from './src/docs-index';
import { handleMcpRequest } from './src/protocol';

const index = parseDocsIndex(await (await fetch('https://ethlete-sdk-docs.web.app/llms-full.txt')).text());

await handleMcpRequest(
  {
    method: 'POST',
    headers: { 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'tools/call', 'mcp-name': 'search_docs' },
    body: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'search_docs', arguments: { query: 'overlay' } },
    },
  },
  { loadIndex: () => Promise.resolve(index), serverInfo: { name: 'x', version: '0' }, isAllowedOrigin: () => true },
);
```

## Environment variables

| Variable              | Effect                                                                   |
| --------------------- | ------------------------------------------------------------------------ |
| `DOCS_ORIGIN`         | Pins the docs origin instead of deriving it from the `Host` header       |
| `MCP_ALLOWED_ORIGINS` | Comma-separated extra browser origins allowed through the `Origin` check |
