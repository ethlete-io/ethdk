import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

/**
 * Every case here is a real breakage from migrating a workspace with the first version of the
 * generator: identifiers were rewritten wherever the *name* matched, without checking what the
 * name resolved to.
 */
describe('migrate-to-query-v3 rename precision', () => {
  let tree: Tree;

  const readFile = (path: string) => tree.read(path, 'utf-8')!;

  const writeClientAndQueries = () => {
    tree.write(
      'libs/api/src/client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({
  baseRoute: 'https://api.example.com',
});
      `.trim(),
    );

    tree.write(
      'libs/api/src/queries.ts',
      `
import { apiClient } from './client';

export const getPerson = apiClient.get({ route: '/person' });
export const postLogin = apiClient.post({ route: '/login' });
      `.trim(),
    );

    tree.write('libs/api/src/index.ts', "export * from './client';\nexport * from './queries';");
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    tree.write(
      'tsconfig.base.json',
      JSON.stringify({ compilerOptions: { paths: { '@app/api': ['libs/api/src/index.ts'] } } }),
    );

    vi.spyOn(console, 'log').mockImplementation(() => {
      // noop
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {
      // noop
    });

    writeClientAndQueries();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not rename a type member that happens to share a creator name', async () => {
    tree.write(
      'libs/app/src/data-source.ts',
      `
export type PeopleDetailDataSource = {
  getPerson: (id: string) => Promise<unknown>;
};

export const createDataSource = (): PeopleDetailDataSource => ({
  getPerson: async (id: string) => ({ id }),
});
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const dataSource = readFile('libs/app/src/data-source.ts');

    expect(dataSource).not.toContain('legacyGetPerson');
    expect(dataSource).toContain('getPerson: (id: string) => Promise<unknown>;');
  });

  it('does not rename an object literal property name in a config type', async () => {
    tree.write(
      'libs/app/src/auth-state.ts',
      `
import { postLogin } from '@app/api';

export type AuthStateConfig = {
  queryCreators: {
    postLogin: typeof postLogin;
  };
};

export const useConfig = (config: AuthStateConfig) => config.queryCreators.postLogin;
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const authState = readFile('libs/app/src/auth-state.ts');

    // The import points at the wrapper, but the property name and the read of it stay in sync.
    expect(authState).toContain("import { legacyPostLogin } from '@app/api';");
    expect(authState).toContain('postLogin: typeof legacyPostLogin;');
    expect(authState).toContain('config.queryCreators.postLogin');
  });

  it('does not rewrite a same-named export from an unrelated package', async () => {
    tree.write('libs/other/src/index.ts', "export * from './campaigns';");
    tree.write('libs/other/src/campaigns.ts', 'export const getPerson = () => ({ notAQuery: true });');
    tree.write(
      'tsconfig.base.json',
      JSON.stringify({
        compilerOptions: {
          paths: { '@app/api': ['libs/api/src/index.ts'], '@app/other': ['libs/other/src/index.ts'] },
        },
      }),
    );

    tree.write(
      'libs/app/src/campaigns.service.ts',
      `
import { getPerson } from '@app/other';

export const useIt = () => getPerson();
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const service = readFile('libs/app/src/campaigns.service.ts');

    expect(service).toContain("import { getPerson } from '@app/other';");
    expect(service).not.toContain('legacyGetPerson');
  });

  it('preserves an import alias instead of dropping it', async () => {
    tree.write(
      'libs/app/src/lookup.ts',
      `
import { getPerson as getPersonQuery } from '@app/api';

export const lookup = (injector: unknown) => getPersonQuery.prepare({ injector });
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const lookup = readFile('libs/app/src/lookup.ts');

    expect(lookup).toContain("import { legacyGetPerson as getPersonQuery } from '@app/api';");
    expect(lookup).toContain('getPersonQuery.prepare(');
  });

  it('renames a plain import and its references', async () => {
    tree.write(
      'libs/app/src/plain.ts',
      `
import { getPerson } from '@app/api';

export const lookup = (injector: unknown) => getPerson.prepare({ injector });
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const plain = readFile('libs/app/src/plain.ts');

    expect(plain).toContain("import { legacyGetPerson } from '@app/api';");
    expect(plain).toContain('legacyGetPerson.prepare(');
  });
});
