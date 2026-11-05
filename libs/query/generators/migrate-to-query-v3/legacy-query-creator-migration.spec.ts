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

    expect(queries).toContain("import { apiGet } from './client';");
    expect(queries).toContain('createLegacyQueryCreator');
    expect(queries).toContain(
      "export const getUsers = apiGet<{ response: User[] }>('/users', {\n  reportErrors: false\n});",
    );
    expect(queries).toContain(
      "export const legacyGetUsers = createLegacyQueryCreator({ name: 'legacyGetUsers', creator: getUsers });",
    );
    expect(queries).toContain('@deprecated Legacy (v2) query wrapper. Migrate the call sites to `getUsers`');

    // The rewrite leaves `def` and the client config behind; they must not survive as imports,
    // because `formatFiles` runs in the same invocation and lint fails on them.
    expect(queries).not.toContain('def');
    expect(queries).not.toContain('apiClientConfig');
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
    expect(client).toContain('export const provideApiClientAuthProvider = toProvideFn(apiClientAuthProvider);');
    expect(client).toContain(
      'export const apiGetSecure = createSecureGetQuery(apiClientConfig, apiClientAuthProvider);',
    );
    expect(queries).toContain("export const getUsers = apiGetSecure('/users', {\n  reportErrors: false\n});");
    expect(report).toContain('Configure auth queries for apiClientAuthProvider');
    expect(report).toContain('authQuery/tokenRefreshQuery builders');
  });
  const writeClient = (path = 'client.ts', name = 'apiClient') => {
    tree.write(
      path,
      `
import { V2QueryClient } from '@ethlete/query';

export const ${name} = new V2QueryClient({
  baseRoute: 'https://api.example.com',
});
      `.trim(),
    );
  };

  const readOrEmpty = (path: string) => tree.read(path, 'utf-8') ?? '';

  it('should combine args with body and response types and carry http options over', async () => {
    writeClient();
    tree.write(
      'queries.ts',
      `
import { def } from '@ethlete/query';
import { apiClient } from './client';

type Args = { pathParams: { id: string } };

export const postUser = apiClient.post({
  route: (p) => \`/users/\${p.id}\`,
  reportProgress: true,
  withCredentials: true,
  types: {
    args: def<Args>(),
    body: def<{ name: string }>(),
    response: def<{ id: string }>(),
  },
});

export const getOne = apiClient.get({
  route: '/one',
  types: {
    args: def<Args>(),
  },
});

export const putBody = apiClient.put({
  route: '/body',
  types: {
    body: def<{ name: string }>(),
  },
});

export const patchWithResponse = apiClient.patch({
  route: '/patch',
  types: {
    args: def<Args>(),
    response: def<{ id: string }>(),
  },
});

export const postWithBody = apiClient.post({
  route: '/post',
  types: {
    args: def<Args>(),
    body: def<{ name: string }>(),
  },
});

export const deleteAll = apiClient.delete({ route: '/all' });
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const queries = readOrEmpty('queries.ts');

    expect(queries).toContain(
      'export const postUser = apiPost<Args & { body: { name: string }; response: { id: string } }>((p) => `/users/${p.id}`, {\n  reportErrors: false,\n  reportProgress: true,\n  withCredentials: true\n});',
    );
    expect(queries).toContain("export const getOne = apiGet<Args>('/one', {\n  reportErrors: false\n});");
    expect(queries).toContain(
      "export const putBody = apiPut<{ body: { name: string } }>('/body', {\n  reportErrors: false\n});",
    );
    expect(queries).toContain(
      "export const patchWithResponse = apiPatch<Args & { response: { id: string } }>('/patch', {\n  reportErrors: false\n});",
    );
    expect(queries).toContain(
      "export const postWithBody = apiPost<Args & { body: { name: string } }>('/post', {\n  reportErrors: false\n});",
    );
    expect(queries).toContain("export const deleteAll = apiDelete('/all', {\n  reportErrors: false\n});");
    expect(queries).toContain("import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client';");
  });

  it('should flag a type that is not written with def for manual review', async () => {
    writeClient();
    tree.write(
      'queries.ts',
      `
import { def } from '@ethlete/query';
import { apiClient } from './client';

type User = { id: string };
const response = null as unknown as User;

export const getUser = apiClient.get({
  route: '/user',
  types: {
    response,
    args: null as unknown as User,
    body: def(),
  },
});
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    expect(readOrEmpty('queries.ts')).toContain("export const getUser = apiGet('/user', {\n  reportErrors: false\n});");

    const report = readOrEmpty('query-v3-migration-tasks.md');

    expect(report).toContain('Verify generated types for getUser');
    expect(report).toContain('could not extract the `args` type for getUser');
    expect(report).toContain('could not extract the `body` type for getUser');
  });

  it('should ignore calls that are not a legacy creator and skip spread config entries', async () => {
    writeClient();
    tree.write(
      'queries.ts',
      `
import { apiClient } from './client';

const shared = { route: '/ignored' };
const holder = { apiClient };

export const viaHolder = holder.apiClient.get({ route: '/holder' });
export const otherMethod = apiClient.toString();
export const otherObject = shared.route.concat('');
export const getReal = apiClient.get({ ...shared, route: '/real' });
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const queries = readOrEmpty('queries.ts');

    expect(queries).toContain("export const viaHolder = holder.apiClient.get({ route: '/holder' });");
    expect(queries).toContain('export const getReal = apiGet(');
    expect(queries).not.toContain('legacyViaHolder');
  });

  it('should migrate a creator whose route is a shorthand property', async () => {
    writeClient();
    tree.write(
      'queries.ts',
      "import { apiClient } from './client';\n\nconst route = '/users';\n\nexport const getUsers = apiClient.get({ route });",
    );

    await migration(tree, { skipFormat: true });

    const queries = readOrEmpty('queries.ts');

    expect(queries).not.toContain('apiClientConfig.get(');
    expect(queries).toContain('export const getUsers = apiGet(route, {\n  reportErrors: false\n});');
    expect(queries).toContain('export const legacyGetUsers = createLegacyQueryCreator(');
  });

  it('should skip empty TypeScript files', async () => {
    writeClient();
    tree.write(
      'queries.ts',
      "import { apiClient } from './client';\n\nexport const getUsers = apiClient.get({ route: '/users' });",
    );
    tree.write('empty.ts', '');

    await migration(tree, { skipFormat: true });

    expect(readOrEmpty('empty.ts')).toBe('');
    expect(readOrEmpty('queries.ts')).toContain('legacyGetUsers');
  });

  it('should keep unrelated names from the client import and rewrite imports of two clients', async () => {
    writeClient('client.ts', 'apiClient');
    writeClient('other-client.ts', 'otherClient');
    tree.write('client.ts', `${readOrEmpty('client.ts')}\n\nexport const API_VERSION = 'v1';`);
    tree.write(
      'queries.ts',
      `
import { API_VERSION, apiClient } from './client';
import { otherClient } from './other-client';

export const getUsers = apiClient.get({ route: \`/\${API_VERSION}/users\` });
export const getOthers = otherClient.get({ route: '/others' });
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const queries = readOrEmpty('queries.ts');

    expect(queries).toContain("import { API_VERSION, apiGet } from './client';");
    expect(queries).toContain("import { otherGet } from './other-client';");
  });

  it('should not create a second auth provider when the client file already declares one', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient, createBearerAuthProvider } from '@ethlete/query';

export const apiClient = new V2QueryClient({
  baseRoute: 'https://api.example.com',
});

export const apiClientAuthProvider = createBearerAuthProvider({ name: 'apiClient' });
      `.trim(),
    );
    tree.write(
      'queries.ts',
      "import { apiClient } from './client';\n\nexport const getUsers = apiClient.get({ route: '/users', secure: true });",
    );

    await migration(tree, { skipFormat: true });

    const client = readOrEmpty('client.ts');

    expect(client.match(/export const apiClientAuthProvider = createBearerAuthProvider\(/g)).toHaveLength(1);
    expect(client).not.toContain('createSecureGetQuery(apiClientConfig');
    expect(readOrEmpty('query-v3-migration-tasks.md')).not.toContain(
      'Configure auth queries for apiClientAuthProvider',
    );
  });
  it('should drop imports that only the rewritten creator config used', async () => {
    writeClient();
    tree.write(
      'options.ts',
      "export default { base: '/v1' };\nexport const sharedOptions = { withCredentials: true };",
    );
    tree.write(
      'queries.ts',
      `
import './polyfills';
import options, { sharedOptions } from './options';
import { apiClient } from './client';

export const getUsers = apiClient.get({ ...sharedOptions, route: \`\${options.base}/users\` });
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const queries = readOrEmpty('queries.ts');

    expect(queries).toContain("import './polyfills';");
    expect(queries).toMatch(/import options\b.* from '\.\/options';/);
    expect(queries).not.toContain('sharedOptions');
  });

  it('should drop an import whose every binding became unused', async () => {
    writeClient();
    tree.write('options.ts', 'export const sharedOptions = { withCredentials: true };');
    tree.write(
      'queries.ts',
      `
import { apiClient } from './client';
import { sharedOptions } from './options';

export const getUsers = apiClient.get({ ...sharedOptions, route: '/users' });
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const queries = readOrEmpty('queries.ts');

    expect(queries).not.toContain("from './options'");
    expect(queries).toContain("export const getUsers = apiGet('/users', {\n  reportErrors: false\n});");
  });

  it('should not silently drop options spread into a creator config', async () => {
    writeClient();
    tree.write(
      'queries.ts',
      "import { apiClient } from './client';\n\nconst shared = { withCredentials: true };\n\nexport const getUsers = apiClient.get({ ...shared, route: '/users' });",
    );

    await migration(tree, { skipFormat: true });

    const queries = readOrEmpty('queries.ts');
    const report = readOrEmpty('query-v3-migration-tasks.md');

    expect(queries).toContain("export const getUsers = apiGet('/users', {\n  reportErrors: false\n});");
    expect(report).toContain('Restore the spread config of getUsers');
    expect(report).toContain('spreads `shared` into its v2 config');
  });

  it('should warn about a shorthand config property it cannot carry over', async () => {
    writeClient();
    tree.write(
      'queries.ts',
      "import { apiClient } from './client';\n\nconst secure = true;\nconst withCredentials = true;\n\nexport const getUsers = apiClient.get({ route: '/users', secure, withCredentials });",
    );

    await migration(tree, { skipFormat: true });

    const queries = readOrEmpty('queries.ts');
    const report = readOrEmpty('query-v3-migration-tasks.md');

    expect(queries).toContain('withCredentials: withCredentials');
    expect(report).toContain('Carry over `secure` of getUsers');
    expect(report).toContain('*Secure creator');
    expect(report).not.toContain('Carry over `withCredentials`');
  });

  it('should warn about a secure flag whose value is not a literal', async () => {
    writeClient();
    tree.write(
      'queries.ts',
      "import { apiClient } from './client';\n\nconst isProd = true;\n\nexport const getUsers = apiClient.get({ route: '/users', secure: isProd });\nexport const getPosts = apiClient.get({ route: '/posts', secure: false });",
    );

    await migration(tree, { skipFormat: true });

    const report = readOrEmpty('query-v3-migration-tasks.md');

    expect(report).toContain('Carry over `secure` of getUsers');
    expect(report).toContain('*Secure creator');
    expect(report).not.toContain('Carry over `secure` of getPosts');
  });

  it('should keep every creator of a multi-declaration statement', async () => {
    writeClient();
    tree.write(
      'queries.ts',
      "import { apiClient } from './client';\n\nexport const getA = apiClient.get({ route: '/a' }),\n  getB = apiClient.get({ route: '/b' });",
    );

    await migration(tree, { skipFormat: true });

    const queries = readOrEmpty('queries.ts');

    expect(queries).toContain("getA = apiGet('/a', {");
    expect(queries).toContain("getB = apiGet('/b', {");
    expect(queries).toContain('export const legacyGetB = createLegacyQueryCreator(');
  });

  it('should not emit an export inside a function body for a locally declared creator', async () => {
    writeClient();
    tree.write(
      'queries.ts',
      "import { apiClient } from './client';\n\nexport function createLookup() {\n  const getA = apiClient.get({ route: '/a' });\n\n  return getA;\n}",
    );

    await migration(tree, { skipFormat: true });

    const queries = readOrEmpty('queries.ts');

    expect(queries).not.toMatch(/createLookup\(\) \{[^}]*export const/);
    expect(queries).toContain("const getA = apiGet('/a', {\n  reportErrors: false\n});");
    expect(queries).toContain('const legacyGetA = createLegacyQueryCreator(');
  });
  it('moves an entity config onto the legacy wrapper and reports gql creators it cannot rewrite', async () => {
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

export const getUser = apiClient.get({
  route: '/user',
  entity: { store: userStore, id: ({ response }) => response.id, set: ({ store, response }) => store.set(response) },
});
export const getGqlUser = apiClient.gqlQuery({ query: USER_QUERY });
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const queries = readFile('queries.ts');
    const report = readFile('query-v3-migration-tasks.md');

    expect(queries).toContain(
      "createLegacyQueryCreator({ name: 'legacyGetUser', creator: getUser, entity: { store: userStore, id: ({ response }) => response.id, set: ({ store, response }) => store.set(response) } });",
    );
    expect(report).toContain('Check the entity config carried onto legacyGetUser');
    expect(report).toContain(
      'declare `invalidates` on the mutation creators that change the entity and `tags` on the reads that show it, and add `withOptimisticUpdate`',
    );
    expect(report).toContain('/query/migrating-from-v2#entitystore-becomes-invalidates-and-tags');
    expect(report).toContain('Rewrite the GraphQL creator getGqlUser by hand');
    expect(report).toContain('createGqlQueryViaPost');
  });

  it('points a gql creator at ViaGet when the v2 client set transferVia GET, and a mutation at ViaPost', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const cmsClient = new V2QueryClient({
  baseRoute: 'https://api.example.com',
  request: { gql: { transferVia: 'GET' } },
});
export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
    );

    tree.write(
      'queries.ts',
      `
import { apiClient, cmsClient } from './client';

export const getPage = cmsClient.gqlQuery({ query: PAGE_QUERY });
export const getUser = apiClient.gqlQuery({ query: USER_QUERY });
export const saveUser = apiClient.gqlMutate({ query: SAVE_USER });
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const report = readFile('query-v3-migration-tasks.md');
    const section = (name: string) => report.slice(report.indexOf(`Rewrite the GraphQL creator ${name} by hand`));

    expect(section('getPage').split('###')[0]).toContain('createGqlQueryViaGet');
    expect(section('getPage').split('###')[0]).toContain('transferVia');
    expect(section('getUser').split('###')[0]).toContain('createGqlQueryViaPost');
    expect(section('saveUser').split('###')[0]).toContain('createGqlMutationViaPost');
    expect(report).not.toContain('Reconfigure dropped query client option "request.gql"');
  });

  it('renames a creator passed as an object property value, a shorthand and an argument', async () => {
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

export const getMatches = apiClient.get({ route: '/matches' });
      `.trim(),
    );

    tree.write(
      'rail.ts',
      `
import { getMatches } from './queries';

export const config = createInfinityQueryConfig({ queryCreator: getMatches, size: 3 });
export const shorthand = { getMatches };
export const list = [getMatches];
export const call = register(getMatches);
export const prepared = getMatches.prepare({});
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const rail = readFile('rail.ts');

    expect(rail).toContain('queryCreator: legacyGetMatches');
    expect(rail).toContain('getMatches: legacyGetMatches');
    expect(rail).toContain('[legacyGetMatches]');
    expect(rail).toContain('register(legacyGetMatches)');
    expect(rail).toContain('legacyGetMatches.prepare(');
    expect(rail).not.toMatch(/[^y]GetMatches\b|\bgetMatches\b[^:]/);
  });

  it('renames a creator value reference reached through a directory barrel', async () => {
    tree.write(
      'apps/web/src/app/queries/client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
    );
    tree.write(
      'apps/web/src/app/queries/match.queries.ts',
      `import { apiClient } from './client';\n\nexport const getMatches = apiClient.get({ route: '/matches' });`,
    );
    tree.write('apps/web/src/app/queries/index.ts', `export * from './client';\nexport * from './match.queries';`);
    tree.write(
      'apps/web/src/app/components/match-rail/match-rail.component.ts',
      `
import { getMatches } from '../../queries';

export const config = createInfinityQueryConfig({ queryCreator: getMatches });
export const prepared = getMatches.prepare({});
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const rail = readFile('apps/web/src/app/components/match-rail/match-rail.component.ts');

    expect(rail).toContain("import { legacyGetMatches } from '../../queries';");
    expect(rail).toContain('queryCreator: legacyGetMatches');
    expect(rail).toContain('legacyGetMatches.prepare(');
  });

  it('rewrites a consumer whose only reference to the creator is a property value', async () => {
    tree.write(
      'apps/web/src/app/queries/client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
    );
    tree.write(
      'apps/web/src/app/queries/match.queries.ts',
      `import { apiClient } from './client';\n\nexport const getMatches = apiClient.get({ route: '/matches', secure: false, types: { args: def<{ queryParams: Q }>(), response: def<Paginated<M>>() } });`,
    );
    tree.write('apps/web/src/app/queries/index.ts', `export * from './client';\nexport * from './match.queries';`);
    tree.write(
      'apps/web/src/app/components/match-rail/match-rail.component.ts',
      `
import { getMatches } from '../../queries';

export const config = computed(() => ({ queryCreator: getMatches, size: 3 }));
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const rail = readFile('apps/web/src/app/components/match-rail/match-rail.component.ts');

    expect(rail).toContain("import { legacyGetMatches } from '../../queries';");
    expect(rail).toContain('queryCreator: legacyGetMatches');
  });

  it('rewrites a consumer when another project declares a creator with the same name', async () => {
    const clientSource = `import { V2QueryClient } from '@ethlete/query';\n\nexport const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });`;

    tree.write('apps/web/src/app/queries/client.ts', clientSource);
    tree.write(
      'apps/web/src/app/queries/match.queries.ts',
      `import { apiClient } from './client';\n\nexport const getMatches = apiClient.get({ route: '/matches' });`,
    );
    tree.write('apps/web/src/app/queries/index.ts', `export * from './client';\nexport * from './match.queries';`);
    tree.write('libs/queries/src/client.ts', clientSource);
    tree.write(
      'libs/queries/src/match.queries.ts',
      `import { apiClient } from './client';\n\nexport const getMatches = apiClient.get({ route: '/matches' });`,
    );
    tree.write(
      'apps/web/src/app/components/rail.component.ts',
      `import { getMatches } from '../queries';\n\nexport const config = { queryCreator: getMatches };`,
    );

    await migration(tree, { skipFormat: true });

    const rail = readFile('apps/web/src/app/components/rail.component.ts');

    expect(rail).toContain("import { legacyGetMatches } from '../queries';");
    expect(rail).toContain('queryCreator: legacyGetMatches');
  });
});
