import { Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { MockInstance } from 'vitest';
import migration from './migration';

describe('prep-for-query-v3', () => {
  let tree: Tree;
  let consoleLogSpy: MockInstance;
  let consoleWarnSpy: MockInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // noop
    });
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // noop
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should skip formatting when skipFormat is true', async () => {
    const content = `
import { Foo    } from '@somewhere';
    `.trim();

    tree.write('test.ts', content);
    await migration(tree, { skipFormat: true });

    const result = tree.read('test.ts', 'utf-8');
    expect(result).toContain('Foo   ');
  });

  describe('Symbol renaming', () => {
    describe('Type renames', () => {
      it('should rename Query to V2Query in imports and usages', async () => {
        tree.write(
          'apps/example/src/app/service.ts',
          `
import { Query, QueryState } from '@ethlete/query';

export class MyService {
  query: Query<any>;
  state: QueryState;
  
  getQuery(): Query<any> {
    return this.query;
  }
}
      `.trim(),
        );

        await migration(tree, { skipFormat: true });

        const content = tree.read('apps/example/src/app/service.ts', 'utf-8')!;

        // Should rename in imports
        expect(content).toContain("import { V2Query, V2QueryState } from '@ethlete/query';");

        // Should rename in type annotations
        expect(content).toContain('query: V2Query<any>;');
        expect(content).toContain('state: V2QueryState;');
        expect(content).toContain('getQuery(): V2Query<any>');
      });

      it('should rename QueryClient and QueryConfig together', async () => {
        tree.write(
          'apps/example/src/app/client.ts',
          `
import { QueryClient, QueryConfig } from '@ethlete/query';

export function setupClient(config: QueryConfig): QueryClient {
  return new QueryClient(config);
}
      `.trim(),
        );

        await migration(tree, { skipFormat: true });

        const content = tree.read('apps/example/src/app/client.ts', 'utf-8')!;

        expect(content).toContain("import { V2QueryClient, V2QueryConfig } from '@ethlete/query';");
        expect(content).toContain('config: V2QueryConfig');
        expect(content).toContain(': V2QueryClient');
      });

      it('should handle aliased imports', async () => {
        tree.write(
          'apps/example/src/app/service.ts',
          `
import { Query as Q, QueryState as QS } from '@ethlete/query';

export class MyService {
  query: Q<any>;
  state: QS;
}
      `.trim(),
        );

        await migration(tree, { skipFormat: true });

        const content = tree.read('apps/example/src/app/service.ts', 'utf-8')!;

        // Should rename the imported symbol but keep the alias
        expect(content).toContain("import { V2Query as Q, V2QueryState as QS } from '@ethlete/query';");
        expect(content).toContain('query: Q<any>;');
        expect(content).toContain('state: QS;');
      });

      it('should rename all type symbols', async () => {
        tree.write(
          'apps/example/src/app/types.ts',
          `
import { 
  BearerAuthProvider,
  AnyQueryCreator,
  CacheAdapterFn,
  Query,
  QueryArgsOf,
  QueryClient,
  QueryClientConfig,
  QueryConfig,
  QueryCreator,
  QueryState,
  RouteType,
  RouteString,
  AnyQuery
} from '@ethlete/query';

export type MyTypes = {
  auth: BearerAuthProvider;
  anyCreator: AnyQueryCreator;
  cache: CacheAdapterFn;
  query: Query<any>;
  args: QueryArgsOf<any>;
  client: QueryClient;
  clientConfig: QueryClientConfig;
  config: QueryConfig;
  creator: QueryCreator<any>;
  state: QueryState;
  route: RouteType;
  routeStr: RouteString;
  anyQ: AnyQuery;
};
      `.trim(),
        );

        await migration(tree, { skipFormat: true });

        const content = tree.read('apps/example/src/app/types.ts', 'utf-8')!;

        // Check imports
        expect(content).toContain('V2BearerAuthProvider');
        expect(content).toContain('AnyV2QueryCreator');
        expect(content).toContain('V2CacheAdapterFn');
        expect(content).toContain('V2Query');
        expect(content).toContain('V2QueryArgsOf');
        expect(content).toContain('V2QueryClient');
        expect(content).toContain('V2QueryClientConfig');
        expect(content).toContain('V2QueryConfig');
        expect(content).toContain('V2QueryCreator');
        expect(content).toContain('V2QueryState');
        expect(content).toContain('V2RouteType');
        expect(content).toContain('V2RouteString');
        expect(content).toContain('AnyV2Query');

        // Check usages
        expect(content).toContain('auth: V2BearerAuthProvider;');
        expect(content).toContain('anyCreator: AnyV2QueryCreator;');
        expect(content).toContain('cache: V2CacheAdapterFn;');
      });
    });

    describe('Function renames', () => {
      it('should rename function imports and calls', async () => {
        tree.write(
          'apps/example/src/app/utils.ts',
          `
import { buildQueryCacheKey, shouldCacheQuery } from '@ethlete/query';

export function getCacheKey(id: string): string {
  return buildQueryCacheKey({ id });
}

export function canCache(query: any): boolean {
  return shouldCacheQuery(query);
}
      `.trim(),
        );

        await migration(tree, { skipFormat: true });

        const content = tree.read('apps/example/src/app/utils.ts', 'utf-8')!;

        // Should rename imports
        expect(content).toContain("import { v2BuildQueryCacheKey, v2ShouldCacheQuery } from '@ethlete/query';");

        // Should rename function calls
        expect(content).toContain('return v2BuildQueryCacheKey({ id });');
        expect(content).toContain('return v2ShouldCacheQuery(query);');
      });

      it('should rename all function symbols', async () => {
        tree.write(
          'apps/example/src/app/helpers.ts',
          `
import { 
  buildQueryCacheKey,
  extractExpiresInSeconds,
  shouldCacheQuery,
  shouldRetryRequest
} from '@ethlete/query';

export function helper1() {
  return buildQueryCacheKey({});
}

export function helper2() {
  return extractExpiresInSeconds({});
}

export function helper3() {
  return shouldCacheQuery({});
}

export function helper4() {
  return shouldRetryRequest({});
}
      `.trim(),
        );

        await migration(tree, { skipFormat: true });

        const content = tree.read('apps/example/src/app/helpers.ts', 'utf-8')!;

        // Check imports
        expect(content).toContain('v2BuildQueryCacheKey');
        expect(content).toContain('v2ExtractExpiresInSeconds');
        expect(content).toContain('v2ShouldCacheQuery');
        expect(content).toContain('v2ShouldRetryRequest');

        // Check calls
        expect(content).toContain('return v2BuildQueryCacheKey({});');
        expect(content).toContain('return v2ExtractExpiresInSeconds({});');
        expect(content).toContain('return v2ShouldCacheQuery({});');
        expect(content).toContain('return v2ShouldRetryRequest({});');
      });
    });

    describe('Mixed imports', () => {
      it('should handle mixed type and function imports', async () => {
        tree.write(
          'apps/example/src/app/mixed.ts',
          `
import { Query, QueryClient, buildQueryCacheKey, shouldCacheQuery } from '@ethlete/query';

export class MyService {
  client: QueryClient;
  
  getQuery(): Query<any> {
    const key = buildQueryCacheKey({});
    const canCache = shouldCacheQuery({});
    return null as any;
  }
}
      `.trim(),
        );

        await migration(tree, { skipFormat: true });

        const content = tree.read('apps/example/src/app/mixed.ts', 'utf-8')!;

        expect(content).toContain('V2Query, V2QueryClient, v2BuildQueryCacheKey, v2ShouldCacheQuery');
        expect(content).toContain('client: V2QueryClient;');
        expect(content).toContain('getQuery(): V2Query<any>');
        expect(content).toContain('const key = v2BuildQueryCacheKey({});');
        expect(content).toContain('const canCache = v2ShouldCacheQuery({});');
      });
    });

    describe('Edge cases', () => {
      it('should not rename symbols from other imports', async () => {
        tree.write(
          'apps/example/src/app/service.ts',
          `
import { Query } from '@ethlete/query';
import { Query as OtherQuery } from './other-library';

export class MyService {
  query: Query<any>;
  otherQuery: OtherQuery;
}
      `.trim(),
        );

        await migration(tree, { skipFormat: true });

        const content = tree.read('apps/example/src/app/service.ts', 'utf-8')!;

        // Should rename @ethlete/query import
        expect(content).toContain("import { V2Query } from '@ethlete/query';");

        // Should NOT rename other library import
        expect(content).toContain("import { Query as OtherQuery } from './other-library';");

        // Should rename ethlete query usage
        expect(content).toContain('query: V2Query<any>;');

        // Should NOT rename other library usage
        expect(content).toContain('otherQuery: OtherQuery;');
      });

      it('should not rename a local name that shadows an imported symbol', async () => {
        tree.write(
          'apps/example/src/app/service.ts',
          `
import { Query, buildQueryCacheKey } from '@ethlete/query';

export const key = buildQueryCacheKey('a', {});
export function local<Query>(value: Query): Query {
  const buildQueryCacheKey = () => 'local';

  return buildQueryCacheKey() as Query;
}
export const read = (query: Query<any>) => query;
          `.trim(),
        );

        await migration(tree, { skipFormat: true });

        const content = tree.read('apps/example/src/app/service.ts', 'utf-8')!;

        expect(content).toContain("import { V2Query, v2BuildQueryCacheKey } from '@ethlete/query';");
        expect(content).toContain("export const key = v2BuildQueryCacheKey('a', {});");
        expect(content).toContain('export function local<Query>(value: Query): Query {');
        expect(content).toContain("  const buildQueryCacheKey = () => 'local';");
        expect(content).toContain('  return buildQueryCacheKey() as Query;');
        expect(content).toContain('export const read = (query: V2Query<any>) => query;');
      });

      it('should rename an imported function used as a shorthand property without changing the key', async () => {
        tree.write(
          'apps/example/src/app/service.ts',
          `
import { buildQueryCacheKey } from '@ethlete/query';

export const helpers = { buildQueryCacheKey };
          `.trim(),
        );

        await migration(tree, { skipFormat: true });

        expect(tree.read('apps/example/src/app/service.ts', 'utf-8')).toContain(
          'export const helpers = { buildQueryCacheKey: v2BuildQueryCacheKey };',
        );
      });

      it('should not rename symbols in files without @ethlete/query imports', async () => {
        tree.write(
          'apps/example/src/app/other.ts',
          `
export class Query {
  // Custom Query class, not from @ethlete/query
}

export function buildQueryCacheKey() {
  // Custom function, not from @ethlete/query
}
      `.trim(),
        );

        await migration(tree, { skipFormat: true });

        const content = tree.read('apps/example/src/app/other.ts', 'utf-8')!;

        // Should not be modified
        expect(content).toContain('export class Query {');
        expect(content).toContain('export function buildQueryCacheKey() {');
        expect(content).not.toContain('V2Query');
        expect(content).not.toContain('v2BuildQueryCacheKey');
      });

      it('should skip spec files', async () => {
        tree.write(
          'apps/example/src/app/service.spec.ts',
          `
import { Query } from '@ethlete/query';

describe('MyService', () => {
  it('should work', () => {
    const query: Query<any> = null as any;
  });
});
      `.trim(),
        );

        await migration(tree, { skipFormat: true });

        const content = tree.read('apps/example/src/app/service.spec.ts', 'utf-8')!;

        // Should not be modified
        expect(content).toContain("import { Query } from '@ethlete/query';");
        expect(content).toContain('const query: Query<any>');
      });

      it('should handle complex type expressions', async () => {
        tree.write(
          'apps/example/src/app/complex.ts',
          `
import { Query, QueryState, QueryCreator } from '@ethlete/query';

export type ComplexType = {
  queries: Array<Query<any>>;
  states: Map<string, QueryState>;
  creator: QueryCreator<any> | null;
  optional?: Query<any>;
  union: Query<any> | QueryState;
};
      `.trim(),
        );

        await migration(tree, { skipFormat: true });

        const content = tree.read('apps/example/src/app/complex.ts', 'utf-8')!;

        expect(content).toContain('queries: Array<V2Query<any>>;');
        expect(content).toContain('states: Map<string, V2QueryState>;');
        expect(content).toContain('creator: V2QueryCreator<any> | null;');
        expect(content).toContain('optional?: V2Query<any>;');
        expect(content).toContain('union: V2Query<any> | V2QueryState;');
      });
    });

    describe('Multiple files', () => {
      it('should rename symbols across multiple files', async () => {
        tree.write(
          'apps/example/src/app/service1.ts',
          `
import { Query, buildQueryCacheKey } from '@ethlete/query';

export const query: Query<any> = null as any;
export const key = buildQueryCacheKey({});
      `.trim(),
        );

        tree.write(
          'apps/example/src/app/service2.ts',
          `
import { QueryClient, shouldCacheQuery } from '@ethlete/query';

export const client: QueryClient = null as any;
export const canCache = shouldCacheQuery({});
      `.trim(),
        );

        await migration(tree, { skipFormat: true });

        const content1 = tree.read('apps/example/src/app/service1.ts', 'utf-8')!;
        const content2 = tree.read('apps/example/src/app/service2.ts', 'utf-8')!;

        expect(content1).toContain('V2Query');
        expect(content1).toContain('v2BuildQueryCacheKey');

        expect(content2).toContain('V2QueryClient');
        expect(content2).toContain('v2ShouldCacheQuery');
      });
    });
  });

  describe('ExperimentalQuery namespace replacement', () => {
    it('warns about ExperimentalQuery helpers that have no v3 export', async () => {
      tree.write(
        'apps/example/src/app/app.config.ts',
        `
import { ExperimentalQuery } from '@ethlete/query';

export const clientConfig = ExperimentalQuery.createQueryClientConfig({ name: 'api', baseUrl: '/api' });
export const providers = [ExperimentalQuery.provideQueryClient(clientConfig), ExperimentalQuery.createQuery];
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const warnings = consoleWarnSpy.mock.calls.flat().join('\n');

      expect(warnings).toContain('apps/example/src/app/app.config.ts:1 createQueryClientConfig');
      expect(warnings).toContain('apps/example/src/app/app.config.ts:1 provideQueryClient');
      expect(warnings).not.toContain('createQuery:');
    });

    it('should replace namespace import with direct imports', async () => {
      tree.write(
        'apps/example/src/app/service.ts',
        `
import { ExperimentalQuery } from '@ethlete/query';

export const myCreator = ExperimentalQuery.createQueryCreator({
  method: 'GET',
  path: '/users'
});

export const myQuery = ExperimentalQuery.createQuery(myCreator);
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const content = tree.read('apps/example/src/app/service.ts', 'utf-8')!;

      // Should replace namespace import with direct imports
      expect(content).toContain("import { createQuery, createQueryCreator } from '@ethlete/query';");

      // Should replace namespace usages with direct references
      expect(content).toContain('export const myCreator = createQueryCreator({');
      expect(content).toContain('export const myQuery = createQuery(myCreator);');
      expect(content).not.toContain('ExperimentalQuery.');
    });

    it('should handle aliased namespace imports', async () => {
      tree.write(
        'apps/example/src/app/service.ts',
        `
import { ExperimentalQuery as E } from '@ethlete/query';

export const creator = E.createQueryCreator({
  method: 'POST',
  path: '/items'
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const content = tree.read('apps/example/src/app/service.ts', 'utf-8')!;

      expect(content).toContain("import { createQueryCreator } from '@ethlete/query';");
      expect(content).toContain('export const creator = createQueryCreator({');
      expect(content).not.toContain('E.');
    });

    it('should sort imported symbols alphabetically', async () => {
      tree.write(
        'apps/example/src/app/service.ts',
        `
import { ExperimentalQuery } from '@ethlete/query';

export const z = ExperimentalQuery.createQuery;
export const a = ExperimentalQuery.createQueryCreator;
export const m = ExperimentalQuery.createLegacyQueryCreator;
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const content = tree.read('apps/example/src/app/service.ts', 'utf-8')!;

      // Should be sorted alphabetically
      expect(content).toContain(
        "import { createLegacyQueryCreator, createQuery, createQueryCreator } from '@ethlete/query';",
      );
    });

    it('should use multi-line format for many imports', async () => {
      tree.write(
        'apps/example/src/app/service.ts',
        `
import { ExperimentalQuery } from '@ethlete/query';

export const a = ExperimentalQuery.createQueryCreator;
export const b = ExperimentalQuery.createQuery;
export const c = ExperimentalQuery.createLegacyQueryCreator;
export const d = ExperimentalQuery.queryComputed;
export const e = ExperimentalQuery.injectQueryClient;
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const content = tree.read('apps/example/src/app/service.ts', 'utf-8')!;

      // Should use multi-line format for more than 3 imports
      expect(content).toMatch(/import \{\n {2}\w+,\n {2}\w+,\n {2}\w+,\n {2}\w+,\n {2}\w+\n\} from '@ethlete\/query';/);
    });

    it('should remove import if no symbols are used', async () => {
      tree.write(
        'apps/example/src/app/service.ts',
        `
import { ExperimentalQuery } from '@ethlete/query';

export class MyService {
  // No usage
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const content = tree.read('apps/example/src/app/service.ts', 'utf-8')!;

      // Import should be removed
      expect(content).not.toContain('ExperimentalQuery');
      expect(content).not.toContain('@ethlete/query');
    });

    it('should not affect files without namespace imports', async () => {
      tree.write(
        'apps/example/src/app/service.ts',
        `
import { createQueryCreator } from '@ethlete/query';

export const creator = createQueryCreator({
  method: 'GET',
  path: '/users'
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const content = tree.read('apps/example/src/app/service.ts', 'utf-8')!;

      // Should remain unchanged
      expect(content).toContain("import { createQueryCreator } from '@ethlete/query';");
      expect(content).toContain('export const creator = createQueryCreator({');
    });

    it('should handle both namespace replacement and symbol renaming', async () => {
      tree.write(
        'apps/example/src/app/service.ts',
        `
import { ExperimentalQuery, Query } from '@ethlete/query';

export const creator = ExperimentalQuery.createQueryCreator({
  method: 'GET',
  path: '/users'
});

export const myQuery: Query<any> = null as any;
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const content = tree.read('apps/example/src/app/service.ts', 'utf-8')!;

      // Should replace namespace and add the symbols
      expect(content).toContain('createQueryCreator');
      expect(content).toContain('export const creator = createQueryCreator({');

      // Should also rename Query to V2Query
      expect(content).toContain('V2Query');
      expect(content).toContain('export const myQuery: V2Query<any> = null as any;');
    });
  });
  describe('Prebuilt packages', () => {
    const declareDependencies = (
      dependencies: Record<string, string>,
      devDependencies: Record<string, string> = {},
    ) => {
      tree.write('.gitignore', 'node_modules\n');
      updateJson(tree, 'package.json', (json) => ({ ...json, dependencies, devDependencies }));
    };

    it('reports installed packages whose declarations import names the v3 package renames', async () => {
      declareDependencies({ '@acme/data-access': '1.0.0' }, { '@acme/testing': '1.0.0' });
      tree.write(
        'node_modules/@acme/data-access/lib/api.d.ts',
        `import { QueryClient, QueryCreator, def } from '@ethlete/query';\nexport declare const client: QueryClient;\n`,
      );
      tree.write(
        'node_modules/@acme/data-access/lib/types.d.ts',
        `export type Q = import('@ethlete/query').AnyQuery;\n`,
      );
      tree.write(
        'node_modules/@acme/testing/index.d.ts',
        `import * as legacy from '@ethlete/query';\nexport declare const creator: legacy.QueryCreator<any, any, any, any, any>;\n`,
      );

      await migration(tree, { skipFormat: true });

      const warnings = consoleWarnSpy.mock.calls.flat().join('\n');

      expect(warnings).toContain('@acme/data-access: AnyQuery, QueryClient, QueryCreator');
      expect(warnings).toContain('@acme/testing: QueryCreator');
      expect(tree.read('node_modules/@acme/data-access/lib/api.d.ts', 'utf-8')).toContain('QueryClient, QueryCreator');
    });

    it('ignores packages that import only kept names, undeclared packages and @ethlete packages', async () => {
      declareDependencies({ '@acme/kept': '1.0.0', '@ethlete/cdk': '5.0.0' });
      tree.write(
        'node_modules/@acme/kept/index.d.ts',
        `import { def } from '@ethlete/query';\nexport declare const x: typeof def;\n`,
      );
      tree.write('node_modules/@ethlete/cdk/index.d.ts', `import { QueryClient } from '@ethlete/query';\n`);
      tree.write('node_modules/undeclared/index.d.ts', `import { QueryClient } from '@ethlete/query';\n`);

      await migration(tree, { skipFormat: true });

      const warnings = consoleWarnSpy.mock.calls.flat().join('\n');

      expect(warnings).not.toContain('@acme/kept');
      expect(warnings).not.toContain('@ethlete/cdk');
      expect(warnings).not.toContain('undeclared');
    });
  });

  it('runs the formatter when skipFormat is not set', async () => {
    tree.write(
      'apps/example/src/app/service.ts',
      `import { Query } from '@ethlete/query';\n\nexport type Q = Query<unknown>;\n`,
    );

    await migration(tree, {});

    expect(tree.read('apps/example/src/app/service.ts', 'utf-8')).toContain('export type Q = V2Query<unknown>;');
  });

  it('skips empty files', async () => {
    tree.write('apps/example/src/app/empty.ts', '');

    await migration(tree, { skipFormat: true });

    expect(tree.read('apps/example/src/app/empty.ts', 'utf-8')).toBe('');
  });

  it('still renames named imports in a file that also has a namespace import', async () => {
    tree.write(
      'apps/example/src/app/service.ts',
      `
import { Query } from '@ethlete/query';
import * as legacy from '@ethlete/query';

export const myQuery: Query<unknown> = legacy.value;
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const content = tree.read('apps/example/src/app/service.ts', 'utf-8');

    expect(content).toContain("import { V2Query } from '@ethlete/query';");
    expect(content).toContain('export const myQuery: V2Query<unknown> = legacy.value;');
  });

  it('renames symbols reached through a namespace import', async () => {
    tree.write(
      'apps/example/src/app/service.ts',
      `
import { Query } from '@ethlete/query';
import * as q from '@ethlete/query';

export const key = q.buildQueryCacheKey('/users', {});
export const query: q.Query<unknown> = q.def<Query<unknown>>();
export const other = q.def();
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const content = tree.read('apps/example/src/app/service.ts', 'utf-8');

    expect(content).toContain("import { V2Query } from '@ethlete/query';");
    expect(content).toContain("export const key = q.v2BuildQueryCacheKey('/users', {});");
    expect(content).toContain('export const query: q.V2Query<unknown> = q.def<V2Query<unknown>>();');
    expect(content).toContain('export const other = q.def();');
  });

  it('flattens ExperimentalQuery reached through a namespace import', async () => {
    tree.write(
      'apps/example/src/app/service.ts',
      `
import * as q from '@ethlete/query';

export const creator = q.ExperimentalQuery.createQueryCreator({ method: 'GET', path: '/users' });
export type Creator = q.ExperimentalQuery.QueryCreator;
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const content = tree.read('apps/example/src/app/service.ts', 'utf-8');

    expect(content).toContain("import * as q from '@ethlete/query';");
    expect(content).toContain('export const creator = q.createQueryCreator({');
    expect(content).toContain('export type Creator = q.QueryCreator;');
  });

  it('leaves a file that only mentions ExperimentalQuery in its own names untouched', async () => {
    const source = `
import { Component } from '@angular/core';

@Component({ selector: 'app-experimental-query-panel', template: '' })
export class ExperimentalQueryPanelComponent {}
    `.trim();

    tree.write('apps/example/src/app/panel.ts', source);

    await migration(tree, { skipFormat: true });

    expect(tree.read('apps/example/src/app/panel.ts', 'utf-8')).toBe(source);
  });

  it('keeps aliased and separately imported symbols when expanding ExperimentalQuery', async () => {
    tree.write(
      'apps/example/src/app/service.ts',
      `
import { inject } from '@angular/core';
import { ExperimentalQuery, createQueryCreator as makeCreator } from '@ethlete/query';
import type { QueryConfig } from '@ethlete/query';

export const client = ExperimentalQuery.createQueryClient({ baseUrl: '' });
export const creator = makeCreator({ method: 'GET', path: '/users' });
export const config: QueryConfig = inject(TOKEN);
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const content = tree.read('apps/example/src/app/service.ts', 'utf-8');

    expect(content).toContain("import { inject } from '@angular/core';");
    expect(content).toContain("import { createQueryClient, createQueryCreator as makeCreator } from '@ethlete/query';");
    expect(content).toContain("import type { V2QueryConfig } from '@ethlete/query';");
    expect(content).toContain('export const client = createQueryClient({');
    expect(content).not.toContain('ExperimentalQuery');
  });

  describe('CLEAR_QUERY_ARGS', () => {
    it('replaces ExperimentalQuery.CLEAR_QUERY_ARGS with null and imports nothing for it', async () => {
      tree.write(
        'apps/example/src/app/match.ts',
        `
import { ExperimentalQuery as E } from '@ethlete/query';

export const matchQuery = getMatch(E.withArgs(() => (id() ? { pathParams: { id: id() } } : E.CLEAR_QUERY_ARGS)));
export type Source = () => Args | E.ClearQueryArgs;
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const content = tree.read('apps/example/src/app/match.ts', 'utf-8')!;

      expect(content).toContain("import { withArgs } from '@ethlete/query';");
      expect(content).toContain('withArgs(() => (id() ? { pathParams: { id: id() } } : null))');
      expect(content).toContain('export type Source = () => Args | null;');
      expect(content).not.toContain('CLEAR_QUERY_ARGS');
      expect(content).not.toContain('ClearQueryArgs');
      expect(consoleWarnSpy.mock.calls.flat().join('\n')).not.toContain('withArgs callbacks return null');
    });

    it('replaces a named CLEAR_QUERY_ARGS import from an early v3 and drops the import', async () => {
      tree.write(
        'apps/example/src/app/match.ts',
        `
import { CLEAR_QUERY_ARGS as CLEAR, withArgs } from '@ethlete/query';
import { ClearQueryArgs } from '@ethlete/query';

const source = (): Args | ClearQueryArgs | typeof CLEAR => CLEAR;
export const matchQuery = getMatch(withArgs(() => source()));
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const content = tree.read('apps/example/src/app/match.ts', 'utf-8')!;

      expect(content).toContain("import { withArgs } from '@ethlete/query';");
      expect(content).toContain('const source = (): Args | null | null => null;');
      expect(content).not.toContain('ClearQueryArgs');
      expect(content).not.toContain('CLEAR');
    });

    it('replaces CLEAR_QUERY_ARGS reached through a namespace import', async () => {
      tree.write(
        'apps/example/src/app/match.ts',
        `
import * as Q from '@ethlete/query';

export const matchQuery = getMatch(Q.ExperimentalQuery.withArgs(() => Q.ExperimentalQuery.CLEAR_QUERY_ARGS));
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      expect(tree.read('apps/example/src/app/match.ts', 'utf-8')).toContain('getMatch(Q.withArgs(() => null));');
    });
    it('keeps a shorthand property and member names intact', async () => {
      tree.write(
        'apps/example/src/app/match.ts',
        `
import { CLEAR_QUERY_ARGS, withArgs } from '@ethlete/query';

export const sentinels = { CLEAR_QUERY_ARGS };
export class Holder {
  CLEAR_QUERY_ARGS = CLEAR_QUERY_ARGS;
}
export const matchQuery = getMatch(withArgs(() => (id() ? { pathParams: { id: id() } } : (CLEAR_QUERY_ARGS satisfies unknown))));
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const content = tree.read('apps/example/src/app/match.ts', 'utf-8')!;

      expect(content).toContain('export const sentinels = { CLEAR_QUERY_ARGS: null };');
      expect(content).toContain('  CLEAR_QUERY_ARGS = null;');
      expect(content).toContain("import { withArgs } from '@ethlete/query';");
    });

    it('turns a re-export from @ethlete/query into a local null export and warns about it', async () => {
      tree.write(
        'libs/shared/src/index.ts',
        `
export { CLEAR_QUERY_ARGS, ClearQueryArgs as Cleared, withArgs } from '@ethlete/query';
export { CLEAR_QUERY_ARGS as CLEAR } from '@ethlete/query';
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const content = tree.read('libs/shared/src/index.ts', 'utf-8')!;

      expect(content).toContain("export { withArgs } from '@ethlete/query';");
      expect(content).toContain('export const CLEAR_QUERY_ARGS = null;');
      expect(content).toContain('export type Cleared = null;');
      expect(content).toContain('export const CLEAR = null;');
      expect(content).not.toContain("CLEAR } from '@ethlete/query'");

      const warnings = consoleWarnSpy.mock.calls.flat().join('\n');

      expect(warnings).toContain('libs/shared/src/index.ts:1');
      expect(warnings).toContain('libs/shared/src/index.ts:2');
    });

    it('turns a local re-export of an imported CLEAR_QUERY_ARGS into a null export', async () => {
      tree.write(
        'libs/shared/src/index.ts',
        `
import { CLEAR_QUERY_ARGS, withArgs } from '@ethlete/query';

export { CLEAR_QUERY_ARGS, withArgs };
export { CLEAR_QUERY_ARGS as CLEAR };
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const content = tree.read('libs/shared/src/index.ts', 'utf-8')!;

      expect(content).toContain("import { withArgs } from '@ethlete/query';");
      expect(content).toContain('export { withArgs };');
      expect(content).toContain('export const CLEAR_QUERY_ARGS = null;');
      expect(content).toContain('export const CLEAR = null;');
      expect(content).not.toMatch(/export \{ CLEAR/);
    });

    it('leaves a local name that shadows CLEAR_QUERY_ARGS alone', async () => {
      tree.write(
        'apps/example/src/app/match.ts',
        `
import { CLEAR_QUERY_ARGS, withArgs } from '@ethlete/query';

const pick = (CLEAR_QUERY_ARGS: string) => CLEAR_QUERY_ARGS.trim();
function build() {
  const CLEAR_QUERY_ARGS = 1;

  return CLEAR_QUERY_ARGS + 1;
}
export const matchQuery = getMatch(withArgs(() => (id() ? { pathParams: { id: id() } } : CLEAR_QUERY_ARGS)));
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const content = tree.read('apps/example/src/app/match.ts', 'utf-8')!;

      expect(content).toContain('const pick = (CLEAR_QUERY_ARGS: string) => CLEAR_QUERY_ARGS.trim();');
      expect(content).toContain('  const CLEAR_QUERY_ARGS = 1;');
      expect(content).toContain('  return CLEAR_QUERY_ARGS + 1;');
      expect(content).toContain('getMatch(withArgs(() => (id() ? { pathParams: { id: id() } } : null)));');
    });
  });

  describe('withArgs returning null', () => {
    it('reports every null a withArgs callback can return', async () => {
      tree.write(
        'apps/example/src/app/lobby.ts',
        `
import { ExperimentalQuery as E } from '@ethlete/query';

export const matchQuery = getMatch(
  E.withArgs(() => {
    const id = matchId();
    if (!side()) return null;
    const unrelated = () => null;
    return id ? { pathParams: { id } } : null;
  }),
);
export const otherQuery = getOther(E.withArgs(() => ({ pathParams: { id: matchId() } })));
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const warnings = consoleWarnSpy.mock.calls.flat().join('\n');

      expect(warnings).toContain('v3 parks the query');
      expect(warnings).toContain('apps/example/src/app/lobby.ts:6');
      expect(warnings).toContain('apps/example/src/app/lobby.ts:8');
      expect(warnings).not.toContain('apps/example/src/app/lobby.ts:7');
      expect(warnings).not.toContain('apps/example/src/app/lobby.ts:11');
      expect(tree.read('apps/example/src/app/lobby.ts', 'utf-8')).toContain(': null;');
    });

    it('reports a null from an already imported withArgs', async () => {
      tree.write(
        'apps/example/src/app/lobby.ts',
        `
import { withArgs as args } from '@ethlete/query';

export const matchQuery = getMatch(args(() => matchId() ?? null));
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      expect(consoleWarnSpy.mock.calls.flat().join('\n')).toContain('apps/example/src/app/lobby.ts:3');
    });

    it('reports a null from a callback passed by reference', async () => {
      tree.write(
        'apps/example/src/app/lobby.ts',
        `
import { withArgs } from '@ethlete/query';

const source = () => (matchId() ? { pathParams: { id: matchId() } } : null);
function other() {
  return null;
}
export class Lobby {
  private args = computed(() => (matchId() ? { pathParams: { id: matchId() } } : null));
  private build() {
    return null;
  }
  a = getA(withArgs(source));
  b = getB(withArgs(other));
  c = getC(withArgs(this.args));
  d = getD(withArgs(this.build));
}
          `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const warnings = consoleWarnSpy.mock.calls.flat().join('\n');

      expect(warnings).toContain('v3 parks the query');
      for (const line of [3, 5, 8, 10])
        expect(warnings).toMatch(new RegExp(`apps/example/src/app/lobby.ts:${line}$`, 'm'));
      expect(warnings).not.toContain('could not be checked');
    });

    it('warns about a callback passed by reference that it cannot follow', async () => {
      tree.write(
        'apps/example/src/app/lobby.ts',
        `
import { withArgs } from '@ethlete/query';
import { matchArgs } from './args';

export const a = getA(withArgs(matchArgs));
export const b = getB(withArgs(store.matchArgs));
export const c = getC(withArgs(() => ({ pathParams: { id: '1' } })));
          `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const warnings = consoleWarnSpy.mock.calls.flat().join('\n');

      expect(warnings).toContain('could not be checked');
      expect(warnings).toContain('apps/example/src/app/lobby.ts:4');
      expect(warnings).toContain('apps/example/src/app/lobby.ts:5');
      expect(warnings).not.toContain('apps/example/src/app/lobby.ts:6');
    });

    it('ignores a local name that shadows withArgs', async () => {
      tree.write(
        'apps/example/src/app/lobby.ts',
        `
import { withArgs } from '@ethlete/query';

export const run = (withArgs: (fn: () => null) => void) => withArgs(() => null);
export const matchQuery = getMatch(withArgs(() => ({ pathParams: { id: '1' } })));
          `.trim(),
      );

      await migration(tree, { skipFormat: true });

      expect(consoleWarnSpy.mock.calls.flat().join('\n')).not.toContain('withArgs callbacks return null');
    });

    it('ignores a withArgs that does not come from @ethlete/query', async () => {
      tree.write(
        'apps/example/src/app/lobby.ts',
        `
import { withArgs } from './local';
import { V2Query } from '@ethlete/query';

export const matchQuery = withArgs(() => null);
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      expect(consoleWarnSpy.mock.calls.flat().join('\n')).not.toContain('withArgs callbacks return null');
    });
  });
});
