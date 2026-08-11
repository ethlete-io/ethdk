// @ts-check
'use strict';

/**
 * Disallows importing the legacy (v2) query system from `@ethlete/query`, and names the current-system
 * API in the message.
 *
 *   import { V2QueryClient, filterSuccess } from '@ethlete/query';
 *   → `V2QueryClient` is the legacy (v2) query system. Use `createQueryClient` instead (…/query/queries).
 *   → `filterSuccess` … Use `query.response()` instead - the query is already signals (…/query/queries).
 *
 * Two things are matched: every `V2`/`AnyV2`-prefixed export - the prefix the library gives the legacy
 * system's half of a colliding name - and the legacy APIs that never collided, which carry their
 * successor from the migration guide. `createLegacyQueryCreator` is deliberately **not** matched: it is
 * the sanctioned interop seam a migration leans on until its call sites are converted.
 *
 * Off by default, and deliberately not type-aware: it names successors rather than repeating the
 * `@deprecated` tag every legacy export already carries. For the whole deprecated surface (including
 * the types this rule leaves alone), enable `@typescript-eslint/no-deprecated` alongside it.
 */

const QUERY_PACKAGE = '@ethlete/query';
const DEFAULT_DOCS_BASE_URL = 'https://ethlete-sdk-docs.web.app';

/**
 * The legacy APIs whose names never collided with the current system, and what the migration guide
 * (`/query/legacy#migrating-to-the-current-system`) maps each one to.
 *
 * @type {Record<string, { to: string, docs: string }>}
 */
const LEGACY_SYMBOLS = {
  def: { to: 'the type parameter of a current creator - `createGetQuery(client)<TArgs>(route)`', docs: '/query/http' },
  BasicAuthProvider: { to: 'no equivalent - the current system authenticates through `createBearerAuthProvider`', docs: '/query/auth' }, // prettier-ignore
  CustomHeaderAuthProvider: { to: '`headers` on `createQueryClient`, which re-reads a function form per request', docs: '/query/queries#the-query-client' }, // prettier-ignore
  EntityStore: { to: 'nothing directly - caching dedupes by request, and shared state derives from signals', docs: '/query/caching' }, // prettier-ignore
  InfinityQuery: { to: '`createPagedQueryStack`', docs: '/query/stacks#paged-queries' },
  InfinityQueryDirective: { to: '`createPagedQueryStack`', docs: '/query/stacks#paged-queries' },
  InfinityQueryTriggerDirective: { to: '`createPagedQueryStack`', docs: '/query/stacks#paged-queries' },
  createInfinityQueryConfig: { to: '`createPagedQueryStack`', docs: '/query/stacks#paged-queries' },
  QueryDirective: { to: "the query's own signals, read directly in the template", docs: '/query/migrating-from-v2#templates-read-signals-not-directives' }, // prettier-ignore
  filterSuccess: { to: '`query.response()`, or `query.response.asObservable()` where a stream is needed', docs: '/query/queries#the-query-object' }, // prettier-ignore
  filterFailure: { to: '`query.error()`, or `query.error.asObservable()` where a stream is needed', docs: '/query/queries#the-query-object' }, // prettier-ignore
  switchQueryState: { to: "the query's own signals - each one is an `ObservableSignal`", docs: '/query/queries#the-query-object' }, // prettier-ignore
  takeUntilResponse: { to: "the query's own signals - each one is an `ObservableSignal`", docs: '/query/queries#the-query-object' }, // prettier-ignore
  toQuerySignal: { to: 'the query object itself - it is already signals', docs: '/query/queries#the-query-object' },
  queryStateSignal: { to: 'the query object itself - it is already signals', docs: '/query/queries#the-query-object' }, // prettier-ignore
  queryStateResponseSignal: { to: '`query.response()`', docs: '/query/queries#the-query-object' },
  queryStateErrorSignal: { to: '`query.error()`', docs: '/query/queries#the-query-object' },
  queryStateLoadingSignal: { to: '`query.loading()`', docs: '/query/queries#the-query-object' },
  validateWithV2Query: { to: '`validateWithQuery`', docs: '/query/errors#validating-against-the-server-as-the-user-types' }, // prettier-ignore
  provideQueryClientForDevtools: { to: '`provideQueryDevtools()` from `@ethlete/query-devtools`, which registers every client at once', docs: '/query-devtools/' }, // prettier-ignore
};

/** The current-system counterparts of the names the legacy system had to give up its half of. */
const V2_SUCCESSORS = {
  V2QueryClient: { to: '`createQueryClient`', docs: '/query/queries#the-query-client' },
  V2QueryClientConfig: { to: 'the config of `createQueryClient`', docs: '/query/queries#the-query-client' },
  V2QueryCreator: { to: '`createGetQuery` and its siblings', docs: '/query/http' },
  AnyV2QueryCreator: { to: '`createGetQuery` and its siblings', docs: '/query/http' },
  V2BearerAuthProvider: { to: '`createBearerAuthProvider` plus the secure creator templates', docs: '/query/auth' },
};

/** @param {any} specifier */
const importedName = (specifier) => {
  if (specifier.type !== 'ImportSpecifier') return null;

  return specifier.imported.name ?? specifier.imported.value ?? null;
};

/** @param {string} name */
const isV2Symbol = (name) => /^(V2|AnyV2)[A-Z]/.test(name);

/** @type {import('eslint').Rule.RuleModule} */
const noLegacyQueryImport = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow importing the legacy (v2) query system; name the current-system API instead.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          /** Base URL the guide paths in the messages are appended to. */
          docsBaseUrl: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      successor: '`{{ name }}` is the legacy (v2) query system. Use {{ to }} instead ({{ docs }}).',
      legacySystem:
        '`{{ name }}` is the legacy (v2) query system. Migrate to the current one - see {{ docs }}, and run `nx g @ethlete/query:migrate-to-query-v3` for the mechanical parts.',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const docsBaseUrl = (options.docsBaseUrl ?? DEFAULT_DOCS_BASE_URL).replace(/\/$/, '');

    return {
      ImportDeclaration(node) {
        const declaration = /** @type {any} */ (node);

        if (declaration.source.value !== QUERY_PACKAGE) return;

        for (const specifier of declaration.specifiers) {
          const name = importedName(specifier);

          if (!name) continue;

          const successor = V2_SUCCESSORS[name] ?? LEGACY_SYMBOLS[name];

          if (successor) {
            context.report({
              node: specifier,
              messageId: 'successor',
              data: { name, to: successor.to, docs: `${docsBaseUrl}${successor.docs}` },
            });

            continue;
          }

          if (!isV2Symbol(name)) continue;

          context.report({
            node: specifier,
            messageId: 'legacySystem',
            data: { name, docs: `${docsBaseUrl}/query/migrating-from-v2` },
          });
        }
      },
    };
  },
};

module.exports = noLegacyQueryImport;
