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
      'const { token, refreshToken } = ((response) => ({ token: response.token, refreshToken: response.refresh }))(response);',
    );
    expect(client).toContain('return { accessToken: token, refreshToken };');
    expect(client).toContain('defaultRememberMe: true,');
    expect(client).toContain('buildArgs: (tokens) => ({ body: { refresh: tokens.refreshToken } }),');
    expect(client).toContain("expiresInPropertyName: 'expires_in',");
    expect(client).toContain("name: 'et-auth',");
    expect(client).toContain("domain: '.example.com',");
    expect(client).toContain('expiresInDays: 30,');
    expect(client).toContain('refreshStrategy: 1000,');
    expect(client).not.toContain('refreshBuffer');
    expect(client).toContain('// Derived from the v2 BearerAuthProvider in auth.ts:4.');
    expect(client).toContain('retryConfig: { maxAttempts: 8 },');
    expect(readFile('query-v3-migration-tasks.md')).not.toContain('Check the cookie');
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
    expect(readFile('query-v3-migration-tasks.md')).toContain(
      'Check the cookie host: v3 keeps the login cookie per host',
    );
  });
  it('pins a non-literal refreshBuffer, maps the cookie options and warns about cookieEnabled', async () => {
    writeAuth(`export const provider = new V2BearerAuthProvider({
  refreshConfig: {
    queryCreator: refresh,
    cookieName: 'et-auth',
    cookiePath: '/app',
    cookieSameSite: 'strict',
    cookieEnabled: false,
    refreshBuffer: REFRESH_BUFFER,
  },
});`);

    await migration(tree, { skipFormat: true });

    const client = readFile('client.ts');

    expect(client).toContain('refreshStrategy: { minBufferMs: REFRESH_BUFFER, maxBufferMs: REFRESH_BUFFER },');
    expect(client).toContain("path: '/app',");
    expect(client).toContain("sameSite: 'strict',");
    expect(readFile('query-v3-migration-tasks.md')).toContain('Replace the v2 cookieEnabled switch');
  });

  it('imports the names the copied config uses from the v2 file and reports local declarations', async () => {
    tree.write(
      'config/auth-constants.ts',
      `export const AUTH_COOKIE_DOMAIN = '.example.com';\nexport const AUTH_COOKIE = 'et-auth';\n`,
    );
    tree.write(
      'config/refresh.ts',
      `export const postRefreshToken = (r: { t: string }) => ({ token: r.t, refreshToken: r.t });\n`,
    );
    tree.write(
      'config/auth.ts',
      `import { V2BearerAuthProvider } from '@ethlete/query';
import { refresh } from '../queries';
import { AUTH_COOKIE, AUTH_COOKIE_DOMAIN } from './auth-constants';
import { postRefreshToken } from './refresh';

const localDays = 30;

export const provider = new V2BearerAuthProvider({
  refreshConfig: {
    queryCreator: refresh,
    responseAdapter: postRefreshToken,
    cookieName: AUTH_COOKIE,
    cookieDomain: AUTH_COOKIE_DOMAIN,
    cookieExpiresInDays: localDays,
  },
});`,
    );

    await migration(tree, { skipFormat: true });

    const client = readFile('client.ts');

    expect(client).toContain("import { AUTH_COOKIE, AUTH_COOKIE_DOMAIN } from './config/auth-constants';");
    expect(client).toContain("import { postRefreshToken } from './config/refresh';");
    expect(readFile('query-v3-migration-tasks.md')).toContain('localDays');
  });
});
