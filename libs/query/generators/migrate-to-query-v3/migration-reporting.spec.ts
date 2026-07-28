import { Tree, addProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('migrate-to-query-v3 reporting and scope', () => {
  let tree: Tree;

  const readFile = (path: string) => tree.read(path, 'utf-8')!;

  const writeClient = (path: string, extraConfig = '') => {
    tree.write(
      path,
      `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({
  baseRoute: 'https://api.example.com',
  ${extraConfig}
});
      `.trim(),
    );
  };

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

  it('reports v2 client options that have no v3 equivalent', async () => {
    writeClient(
      'client.ts',
      `request: {
    autoRefreshQueriesOnWindowFocus: true,
    enableSmartPolling: true,
  },
  logging: {
    preparedQuerySubscriptions: true,
  },`,
    );

    await migration(tree, { skipFormat: true });

    const report = readFile('query-v3-migration-tasks.md');

    expect(report).toContain('request.autoRefreshQueriesOnWindowFocus');
    expect(report).toContain('request.enableSmartPolling');
    expect(report).toContain('logging.preparedQuerySubscriptions');
  });

  it('reports a missing provideHttpClient', async () => {
    writeClient('client.ts');
    tree.write('apps/web/src/app/app.config.ts', 'export const appConfig: ApplicationConfig = { providers: [] };');
    tree.write('queries.ts', "import { apiClient } from './client';\nexport const q = apiClient.get({ route: '/x' });");

    await migration(tree, { skipFormat: true });

    const report = readFile('query-v3-migration-tasks.md');

    expect(report).toContain('Add provideHttpClient() to the application providers');
    expect(report).toContain('apps/web/src/app/app.config.ts');
  });

  it('reports v2 default headers as a client-level headers option', async () => {
    writeClient('client.ts');
    tree.write('queries.ts', "import { apiClient } from './client';\nexport const q = apiClient.get({ route: '/x' });");
    tree.write('headers.ts', "apiClient.setDefaultHeaders({ headers: { 'X-Api-Token': 'abc' } });");

    await migration(tree, { skipFormat: true });

    const report = readFile('query-v3-migration-tasks.md');

    expect(report).toContain('Move default headers onto the query client');
    expect(report).toContain('refreshQueriesInUse');
  });

  it('migrates the devtools rather than dropping them', async () => {
    writeClient('client.ts');
    tree.write('queries.ts', "import { apiClient } from './client';\nexport const q = apiClient.get({ route: '/x' });");
    tree.write(
      'app.config.ts',
      `
import { provideQueryClientForDevtools } from '@ethlete/query';

export const appConfig = { providers: [provideQueryClientForDevtools({ client: apiClient, displayName: 'API' })] };
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    expect(readFile('app.config.ts')).toContain('provideQueryDevtools()');
    expect(readFile('query-v3-migration-tasks.md')).not.toContain('Re-add the query devtools');
  });

  it('scaffolds the auth provider from the v2 bearer config', async () => {
    writeClient('client.ts');
    tree.write(
      'queries.ts',
      `
import { apiClient } from './client';

export const refresh = apiClient.post({ route: '/auth/refresh' });
export const getMe = apiClient.get({ route: '/me', secure: true });
      `.trim(),
    );
    tree.write(
      'auth.ts',
      `
import { V2BearerAuthProvider } from '@ethlete/query';
import { refresh } from './queries';

export const provider = new V2BearerAuthProvider({
  refreshConfig: {
    queryCreator: refresh,
    cookieName: 'et-auth',
    responseAdapter: (response) => ({ token: response.token, refreshToken: response.refresh_token }),
  },
});
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const client = readFile('client.ts');
    const report = readFile('query-v3-migration-tasks.md');

    expect(client).toContain("withRefreshQuery('tokenRefresh'");
    expect(client).toContain('queryCreator: refresh,');
    expect(client).toContain('withPersistentAuth({');
    expect(client).toContain("name: 'et-auth',");
    expect(client).not.toContain('queries: [],');

    expect(report).toContain('Finish the scaffolded auth provider apiClientAuthProvider');
    expect(report).toContain('Keep the auth queries in client.ts');
  });

  it('only migrates the requested projects', async () => {
    addProjectConfiguration(tree, 'api', { root: 'libs/api', sourceRoot: 'libs/api/src' });
    addProjectConfiguration(tree, 'other', { root: 'libs/other', sourceRoot: 'libs/other/src' });

    writeClient('libs/api/src/client.ts');
    writeClient('libs/other/src/client.ts');

    await migration(tree, { skipFormat: true, projects: ['api'] });

    expect(readFile('libs/api/src/client.ts')).toContain('createQueryClient');
    expect(readFile('libs/other/src/client.ts')).toContain('new V2QueryClient');
  });

  it('rejects an unknown project instead of migrating everything', async () => {
    writeClient('libs/api/src/client.ts');

    await expect(migration(tree, { skipFormat: true, projects: ['nope'] })).rejects.toThrow('Unknown project "nope"');
  });
});
