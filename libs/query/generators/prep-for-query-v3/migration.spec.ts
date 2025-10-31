import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
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
});
