import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('migrate-to-query-v3 auth provider scaffold', () => {
  let tree: Tree;

  const readFile = (path: string) => tree.read(path, 'utf-8') ?? '';

  const writeAuth = (body: string) => {
    tree.write(
      'auth.ts',
      `import { V2BearerAuthProvider } from '@ethlete/query';\nimport { refresh } from './queries';\n\n${body}`,
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

    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
    );
    tree.write(
      'queries.ts',
      `
import { apiClient } from './client';

export const refresh = apiClient.post({ route: '/auth/refresh' });
export const getMe = apiClient.get({ route: '/me', secure: true });
      `.trim(),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('carries every refreshConfig option over to the v3 provider', async () => {
    writeAuth(`export const provider = new V2BearerAuthProvider({
  refreshConfig: {
    ...baseRefreshConfig,
    queryCreator: refresh,
    responseAdapter: (response) => ({ token: response.token, refreshToken: response.refresh }),
    requestArgsAdapter: (tokens) => ({ body: { refresh: tokens.refreshToken } }),
    expiresInPropertyName: 'expires_in',
    cookieName: 'et-auth',
    cookieDomain: '.example.com',
    cookieExpiresInDays: 30,
    refreshBuffer: 1000,
  },
});`);

    await migration(tree, { skipFormat: true });

    const client = readFile('client.ts');

    expect(client).toContain(
      'extractTokens: (response) => ({ token: response.token, refreshToken: response.refresh }),',
    );
    expect(client).toContain('buildArgs: (tokens) => ({ body: { refresh: tokens.refreshToken } }),');
    expect(client).toContain("expiresInPropertyName: 'expires_in',");
    expect(client).toContain("name: 'et-auth',");
    expect(client).toContain("domain: '.example.com',");
    expect(client).toContain('expiresInDays: 30,');
    expect(client).not.toContain('refreshBuffer');
    expect(client).toContain('// Derived from the v2 BearerAuthProvider in auth.ts:4.');
  });

  it('falls back to an empty provider when no v2 config names a refresh creator', async () => {
    writeAuth(`export const fromVariable = new V2BearerAuthProvider(authConfig);
export const withoutRefresh = new V2BearerAuthProvider({ tokenPrefix: 'Bearer' });
export const withSharedRefresh = new V2BearerAuthProvider({ refreshConfig: sharedRefreshConfig });
export const withMemberCreator = new V2BearerAuthProvider({ refreshConfig: { queryCreator: queries.refresh } });`);

    await migration(tree, { skipFormat: true });

    expect(readFile('client.ts')).toContain('queries: [],');
    expect(readFile('query-v3-migration-tasks.md')).toContain('Configure auth queries for apiClientAuthProvider');
  });

  it('carries a shorthand cookieName over to withPersistentAuth', async () => {
    writeAuth(`const cookieName = 'et-auth';

export const provider = new V2BearerAuthProvider({
  refreshConfig: {
    queryCreator: refresh,
    cookieName,
  },
});`);

    await migration(tree, { skipFormat: true });

    const client = readFile('client.ts');

    expect(client).toContain('withPersistentAuth({');
    expect(client).toContain('name: cookieName,');
  });
});
