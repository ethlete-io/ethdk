import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('migrate-to-query-v3 legacy query creator migration', () => {
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

  it('should transform legacy creators and add legacy wrappers', async () => {
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
      'queries.ts',
      `
import { def } from '@ethlete/query';
import { apiClient } from './client';

type User = { id: string };

export const getUsers = apiClient.get({
  route: '/users',
  types: {
    response: def<User[]>(),
  },
});
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const queries = readFile('queries.ts');

    expect(queries).toContain("import { apiClientConfig, apiGet } from './client';");
    expect(queries).toContain('createLegacyQueryCreator');
    expect(queries).toContain("export const getUsers = apiGet<{ response: User[] }>('/users');");
    expect(queries).toContain('export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });');
  });

  it('should create auth providers for secure queries and record a follow-up task', async () => {
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
      'queries.ts',
      `
import { apiClient } from './client';

export const getUsers = apiClient.get({
  route: '/users',
  secure: true,
});
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const client = readFile('client.ts');
    const queries = readFile('queries.ts');
    const report = readFile('query-v3-migration-tasks.md');

    expect(client).toContain('createBearerAuthProvider');
    expect(client).toContain('export const apiClientAuthProvider = createBearerAuthProvider({');
    expect(client).toContain('queryClientRef: apiClientConfig');
    expect(client).toContain('queries: []');
    expect(client).toContain(
      'export const [provideApiClientAuthProvider, injectApiClientAuthProvider] = apiClientAuthProvider;',
    );
    expect(client).toContain(
      'export const apiGetSecure = createSecureGetQuery(apiClientConfig, apiClientAuthProvider);',
    );
    expect(queries).toContain("export const getUsers = apiGetSecure('/users');");
    expect(report).toContain('Configure auth queries for apiClientAuthProvider');
    expect(report).toContain('authQuery/tokenRefreshQuery builders');
  });
});
