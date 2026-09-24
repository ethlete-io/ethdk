import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';

const repoRoot = join(__dirname, '../../../..');
const queryEntry = join(repoRoot, 'libs/query/src/index.ts');
const queryDocs = join(repoRoot, 'apps/docs/query');
const skill = readFileSync(join(__dirname, '../../content/skills/query/SKILL.md'), 'utf8');

const CAPABILITY_PREFIX = /^(create|define|with|query|inject)/;
const SKIPPED_ENTRIES = ['./lib/legacy'];

const IGNORED = new Set([
  'createBaseQuery',
  'createBaseQueryCreator',
  'createExecuteFn',
  'createGqlExecuteFn',
  'createGqlQuery',
  'createGqlQueryCreator',
  'createHttpRequest',
  'createPersistentAuthFeature',
  'createQuery',
  'createQueryContext',
  'createQueryCreator',
  'createQueryInvalidationFilter',
  'createQueryKeyLockManager',
  'createQueryObject',
  'createQueryPersistenceEngine',
  'createQueryRepository',
  'createQuerySnapshotFn',
  'createQuerySyncEngine',
  'createQuerySyncTransport',
  'createSecureExecuteFactory',
  'createSecureExecuteFn',
  'createSecureGqlExecuteFn',
  'createSecureGqlQuery',
  'createSecureGqlQueryCreator',
  'createSecureQuery',
  'createSecureQueryCreator',
  'createTrackingFeature',
  'injectQueryContext',
  'queryBatchAlreadyRunning',
  'queryBatchWithArgsUsed',
  'queryClientFeatureUsedMultipleTimes',
  'queryCreatedInReactiveContext',
  'queryExecute',
  'queryExecutedAfterDestroyMessage',
  'queryFeatureUsedMultipleTimes',
  'querySequenceAlreadyRunning',
  'queryStackWithArgsUsed',
  'queryStackWithResponseUpdateUsed',
  'withArgsQueryFeatureMissingButRouteIsFunction',
  'withAutoRefreshUsedInManualQuery',
  'withAutoRefreshUsedOnUnsupportedHttpMethod',
  'withLongPollingUsedOnUnsupportedHttpMethod',
  'withLongPollingUsedWithPolling',
  'withPollingUsedOnUnsupportedHttpMethod',
  'withQueryDevtoolsOverridePersistence',
]);

const IGNORED_PATTERNS = [/^queryDevtools/, /^createQueryDevtools/];

const resolveModule = (fromFile: string, specifier: string) => {
  const base = join(dirname(fromFile), specifier);
  const candidate = [`${base}.ts`, join(base, 'index.ts')].find((path) => existsSync(path) && statSync(path).isFile());

  if (!candidate) throw new Error(`Cannot resolve ${specifier} from ${fromFile}`);

  return candidate;
};

const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const collectRuntimeExports = (file: string, names = new Set<string>(), visited = new Set<string>()) => {
  if (visited.has(file)) return names;
  visited.add(file);

  const source = stripComments(readFileSync(file, 'utf8'));

  for (const [, specifier] of source.matchAll(/export \* from '([^']+)'/g)) {
    if (!specifier) continue;
    if (file === queryEntry && SKIPPED_ENTRIES.includes(specifier)) continue;
    collectRuntimeExports(resolveModule(file, specifier), names, visited);
  }

  for (const [, name] of source.matchAll(
    /export\s+(?:declare\s+)?(?:abstract\s+)?(?:const|let|function\*?|class|enum)\s+([A-Za-z0-9_$]+)/g,
  )) {
    if (name) names.add(name);
  }

  for (const [, list = ''] of source.matchAll(/export\s+\{([^}]+)\}/g)) {
    for (const part of list.split(',').map((entry) => entry.trim())) {
      if (!part || part.startsWith('type ')) continue;
      names.add(
        part
          .split(/\s+as\s+/)
          .pop()
          ?.trim() ?? part,
      );
    }
  }

  return names;
};

describe('query skill', () => {
  it('names every capability the @ethlete/query entry exports', () => {
    const missing = [...collectRuntimeExports(queryEntry)]
      .filter((name) => CAPABILITY_PREFIX.test(name))
      .filter((name) => !IGNORED.has(name) && !IGNORED_PATTERNS.some((pattern) => pattern.test(name)))
      .filter((name) => !new RegExp(`\`${name}(\\(\\))?\``).test(skill))
      .sort();

    expect(missing).toEqual([]);
  });

  it('links every page of the query docs', () => {
    const unlinked = readdirSync(queryDocs)
      .filter((file) => file.endsWith('.md'))
      .map((file) => (file === 'index.md' ? '' : file.slice(0, -'.md'.length)))
      .filter((slug) => !new RegExp(`\\{%docsBaseUrl%\\}/query/${slug}(?![a-z0-9-])`).test(skill));

    expect(unlinked).toEqual([]);
  });

  it('ignores only names the entry still exports', () => {
    const exported = collectRuntimeExports(queryEntry);

    expect([...IGNORED].filter((name) => !exported.has(name))).toEqual([]);
  });
});
