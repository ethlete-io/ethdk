import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('migrate-to-query-v3 query client migration', () => {
  let tree: Tree;

  const readFile = (path: string) => tree.read(path, 'utf-8')!;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    vi.spyOn(console, 'log').mockImplementation(() => {
      // noop
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {
      // noop
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should migrate V2QueryClient to createQueryClient and generate aliases plus creators', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({
  baseRoute: 'https://api.example.com',
  request: {
    queryParams: { arrayFormat: 'brackets' },
    cacheAdapter: myCacheAdapter,
  },
});
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const result = readFile('client.ts');

    expect(result).toContain('createQueryClient');
    expect(result).toContain("baseUrl: 'https://api.example.com'");
    expect(result).toContain("name: 'apiClient'");
    expect(result).toContain("queryString: { arrayFormat: 'brackets' }");
    expect(result).toContain('cacheAdapter: myCacheAdapter');
    expect(result).toContain('export const apiClientConfig = createQueryClient({');
    expect(result).toContain('export const provideApiClient = toProvideFn(apiClientConfig);');
    expect(result).toContain('export const injectApiClient = toInjectFn(apiClientConfig);');
    expect(result).toContain('export const apiGet = createGetQuery(apiClientConfig);');
    expect(result).toContain('export const apiDelete = createDeleteQuery(apiClientConfig);');
    expect(result).not.toContain('createQueryClientConfig');
    expect(result).not.toContain('V2QueryClient');
  });

  it('should rename imports across the workspace without adding obsolete app providers', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({
  baseRoute: 'https://api.example.com',
});
      `.trim(),
    );

    tree.write(
      'app.config.ts',
      `
import { apiClient } from './client';

export const clientRef = apiClient;
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const appConfig = readFile('app.config.ts');

    expect(appConfig).toContain("import { apiClientConfig } from './client';");
    expect(appConfig).toContain('clientRef = apiClientConfig');
    expect(appConfig).not.toContain('provideQueryClient(');
  });

  it('keeps a client that already ends in Config under its own name', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const apiConfig = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
    );
    tree.write('app.config.ts', "import { apiConfig } from './client';\nexport const clientRef = apiConfig;");

    await migration(tree, { skipFormat: true });

    const result = readFile('client.ts');

    expect(result).toContain('export const apiConfig = createQueryClient({');
    expect(result).toContain("name: 'apiConfig'");
    expect(result).toContain('export const provideApi = toProvideFn(apiConfig);');
    expect(result).toContain('export const injectApi = toInjectFn(apiConfig);');
    expect(readFile('app.config.ts')).toContain('clientRef = apiConfig;');
  });

  it('warns when the Config-suffixed name is already declared', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

const apiClientConfig = { retries: 3 };

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
export const registry = { apiClient: apiClient };
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    expect(readFile('query-v3-migration-tasks.md')).toContain('Resolve query client rename collision for apiClient');
    expect(readFile('client.ts')).toContain('registry = { apiClient: apiClientConfig }');
  });

  it('reports unknown client options with a generic action and migrates retryFn', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({
  baseRoute: 'https://api.example.com',
  authProvider: legacyAuth,
  request: {
    retryFn: myRetry,
    timeout: 5000,
  },
});
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const report = readFile('query-v3-migration-tasks.md');

    expect(readFile('client.ts')).toContain('retryFn: myRetry');
    expect(report).toContain('Reconfigure dropped query client option "authProvider"');
    expect(report).toContain('Reconfigure dropped query client option "request.timeout"');
    expect(report).toContain('Check whether the behaviour is still needed and reimplement it.');
    expect(report).toContain('- client.ts:5');
  });

  it('reports a dropped option once per file even when several clients set it', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://a.example.com', request: { enableSmartPolling: true } });
export const cmsClient = new V2QueryClient({ baseRoute: 'https://b.example.com', request: { enableSmartPolling: true } });
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const report = readFile('query-v3-migration-tasks.md');

    expect(
      report.match(/### QV3-\d+ - Reconfigure dropped query client option "request.enableSmartPolling"/g),
    ).toHaveLength(1);
    expect(readFile('client.ts')).toContain('export const cmsClientConfig = createQueryClient({');
  });

  it('leaves v3 clients that already live in the same file alone', async () => {
    tree.write(
      'client.ts',
      `
import { createGetQuery, createQueryClient, V2QueryClient } from '@ethlete/query';
import { toInjectFn, toProvideFn } from '@ethlete/core';

export const sharedConfig = createQueryClient(sharedOptions);
export const dynamicConfig = createQueryClient({ name: clientName });
export const renamedConfig = createQueryClient({ name: 'mismatch' });
export const cmsConfig = createQueryClient({ name: 'cms' });
export const provideCms = toProvideFn(cmsConfig);
export const injectCms = toInjectFn(cmsConfig);
export const cmsGet = createGetQuery(cmsConfig);

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const result = readFile('client.ts');

    expect(result.match(/export const injectCms = /g)).toHaveLength(1);
    expect(result.match(/export const cmsGet = /g)).toHaveLength(1);
    expect(result).not.toContain('injectMismatch');
    expect(result).not.toContain('mismatchGet');
    expect(result).toContain('export const injectApiClient = toInjectFn(apiClientConfig);');
    expect(result).toContain('export const apiGet = createGetQuery(apiClientConfig);');
  });

  it('renames references to the client but not same-named declarations or members', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
    );
    tree.write(
      'consumer.ts',
      `
import { apiClient } from './client';

export const refs = { apiClient: apiClient };
export const fallback = (client = apiClient) => client;
export function apiClientFactory() {}
export class Holder {
  apiClient = apiClient;
  other = foo.apiClient;
  apiClientName() {}
}
      `.trim(),
    );
    tree.write(
      'unrelated.ts',
      `
export function apiClient() {}
export class Other {
  apiClient() {}
}
export const describeClient = (apiClient: string) => typeof apiClient;
      `.trim(),
    );
    tree.write('empty.ts', '');

    await migration(tree, { skipFormat: true });

    const consumer = readFile('consumer.ts');
    const unrelated = readFile('unrelated.ts');

    expect(unrelated).toContain('export function apiClient() {}');
    expect(unrelated).toContain('  apiClient() {}');
    expect(unrelated).toContain('(apiClient: string)');

    expect(consumer).toContain("import { apiClientConfig } from './client';");
    expect(consumer).toContain('refs = { apiClient: apiClientConfig }');
    expect(consumer).toContain('(client = apiClientConfig) => client');
    expect(consumer).toContain('apiClient = apiClientConfig;');
    expect(consumer).toContain('other = foo.apiClient;');
  });

  it('renames the exported client behind an aliased import', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
    );
    tree.write('consumer.ts', "import { apiClient as api } from './client';\nexport const clientRef = api;");

    await migration(tree, { skipFormat: true });

    const consumer = readFile('consumer.ts');

    expect(consumer).toContain("import { apiClientConfig as api } from './client';");
    expect(consumer).toContain('clientRef = api;');
  });

  it('carries a shorthand baseRoute over to baseUrl', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

const baseRoute = environment.apiUrl;

export const apiClient = new V2QueryClient({ baseRoute });
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    expect(readFile('client.ts')).toContain('baseUrl: baseRoute');
  });

  it('does not strip the V2QueryClient import from a client it cannot migrate', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient(sharedClientConfig);
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const result = readFile('client.ts');

    expect(result).toContain('new V2QueryClient(sharedClientConfig)');
    expect(result).toMatch(/import \{[^}]*\bV2QueryClient\b[^}]*\} from '@ethlete\/query';/);
    expect(readFile('query-v3-migration-tasks.md')).toContain(
      'Migrate a V2QueryClient whose config is not an object literal',
    );
  });

  it('warns about spread client options and carries shorthand request options over', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({
  ...sharedOptions,
  baseRoute: 'https://api.example.com',
  request: {
    ...sharedRequest,
    retryFn,
  },
});
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const report = readFile('query-v3-migration-tasks.md');

    expect(readFile('client.ts')).toContain('retryFn: retryFn');
    expect(report).toContain('Reconfigure spread query client options "...sharedOptions"');
    expect(report).toContain('Reconfigure spread query client options "...sharedRequest"');
    expect(report).toContain('- client.ts:4');
    expect(report).toContain('- client.ts:7');
  });

  it('does not rename a parameter or local variable that shadows the client', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
    );
    tree.write(
      'consumer.ts',
      `
import { apiClient } from './client';

export function build(apiClient: unknown) {
  return apiClient;
}
export function local() {
  const apiClient = 1;
  return apiClient;
}
export const ref = apiClient;
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const consumer = readFile('consumer.ts');

    expect(consumer).toContain('export function build(apiClient: unknown) {\n  return apiClient;');
    expect(consumer).toContain('const apiClient = 1;\n  return apiClient;');
    expect(consumer).toContain('ref = apiClientConfig;');
  });

  it('removes the V2QueryClient import when the file has a second @ethlete/query import', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';
import type { QueryArgs } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const result = readFile('client.ts');

    expect(result).not.toContain('V2QueryClient');
    expect(result).toContain('import type { QueryArgs }');
  });

  it('does not rename unrelated `client` identifiers for a client without a variable', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export default new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
    );
    tree.write('http.ts', "export const client = inject(HttpClient);\nclient.get('/x');");

    await migration(tree, { skipFormat: true });

    expect(readFile('http.ts')).toBe("export const client = inject(HttpClient);\nclient.get('/x');");
  });
});
