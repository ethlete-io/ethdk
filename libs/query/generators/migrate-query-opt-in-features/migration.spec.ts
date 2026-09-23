import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('migrate-query-opt-in-features', () => {
  let tree: Tree;

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

  const run = async (content: string, options: Record<string, unknown> = {}) => {
    tree.write('client.ts', content);
    await migration(tree, options);

    return {
      client: tree.read('client.ts', 'utf-8') ?? '',
      report: tree.read('query-opt-in-features-migration-tasks.md', 'utf-8') ?? '',
    };
  };

  it('adds the error pipeline feature to a client', async () => {
    const { client } = await run(
      `import { createQueryClient } from '@ethlete/query';\n\nexport const CLIENT = createQueryClient({ baseUrl: 'https://api.example.com', name: 'api' });\n`,
    );

    expect(client).toContain('features: [withEthleteApiErrors()]');
    expect(client).toContain(`import { createQueryClient, withEthleteApiErrors } from '@ethlete/query';`);
  });

  it('appends to an existing features array', async () => {
    const { client } = await run(
      `import { createQueryClient, withMultiTabSync } from '@ethlete/query';\n\nexport const CLIENT = createQueryClient({ name: 'api', baseUrl: 'x', features: [withMultiTabSync()] });\n`,
    );

    expect(client).toContain('features: [withMultiTabSync(), withEthleteApiErrors()]');
  });

  it('turns the auth multiTabSync option into a feature', async () => {
    const { client } = await run(
      `import { createBearerAuthProvider } from '@ethlete/query';\n\nexport const AUTH = createBearerAuthProvider({ name: 'auth', queryClientRef: CLIENT, queries: [], multiTabSync: { channelName: 'custom' } });\n`,
    );

    expect(client).toContain(`features: [withBearerAuthMultiTabSync({ channelName: 'custom' })]`);
    expect(client).not.toContain('multiTabSync:');
    expect(client).toContain(`import { createBearerAuthProvider, withBearerAuthMultiTabSync } from '@ethlete/query';`);
  });

  it('drops multi-tab sync that was turned off', async () => {
    const { client } = await run(
      `import { createBearerAuthProvider } from '@ethlete/query';\n\nexport const AUTH = createBearerAuthProvider({ name: 'auth', queryClientRef: CLIENT, queries: [], multiTabSync: false });\n`,
    );

    expect(client).not.toContain('withBearerAuthMultiTabSync');
    expect(client).not.toContain('multiTabSync');
  });

  it('only reports affected sites in reportOnly mode', async () => {
    const source = `import { createQueryClient } from '@ethlete/query';\n\nexport const CLIENT = createQueryClient({ baseUrl: 'https://api.example.com', name: 'api' });\n`;
    const { client, report } = await run(source, { reportOnly: true });

    expect(client).toBe(source);
    expect(report).toContain('client.ts:3');
    expect(report).toContain('Client kept the full error pipeline');
  });

  it('reports a config it cannot read instead of changing it', async () => {
    const { report } = await run(
      `import { createQueryClient } from '@ethlete/query';\n\nexport const CLIENT = createQueryClient(config);\n`,
    );

    expect(report).toContain('createQueryClient called with a non-literal config');
  });
  const auth = (config: string) =>
    `import { createBearerAuthProvider } from '@ethlete/query';\n\nexport const AUTH = createBearerAuthProvider(${config});\n`;

  it('adds multi-tab sync to an auth provider that never configured it', async () => {
    const { client, report } = await run(auth(`{ name: 'auth', queryClientRef: CLIENT, queries: [] }`));

    expect(client).toContain(`features: [withBearerAuthMultiTabSync()]`);
    expect(client).toContain(`import { createBearerAuthProvider, withBearerAuthMultiTabSync } from '@ethlete/query';`);
    expect(report).toContain('Auth provider kept multi-tab sync');
  });

  it('turns multiTabSync: true into a feature without config', async () => {
    const { client } = await run(auth(`{ name: 'auth', queryClientRef: CLIENT, queries: [], multiTabSync: true }`));

    expect(client).toContain(`features: [withBearerAuthMultiTabSync()]`);
    expect(client).not.toContain('multiTabSync:');
  });

  it('drops multi-tab sync whose config object disables it', async () => {
    const { client, report } = await run(
      auth(`{ name: 'auth', queryClientRef: CLIENT, queries: [], multiTabSync: { enabled: false, channelName: 'x' } }`),
    );

    expect(client).not.toContain('withBearerAuthMultiTabSync');
    expect(client).not.toContain('multiTabSync');
    expect(client).not.toContain('features:');
    expect(report).not.toContain('Auth provider kept multi-tab sync');
  });

  it('drops the enabled flag from a config object that turns multi-tab sync on', async () => {
    const { client } = await run(
      auth(`{ name: 'auth', queryClientRef: CLIENT, queries: [], multiTabSync: { enabled: true } }`),
    );

    expect(client).toContain(`features: [withBearerAuthMultiTabSync()]`);
    expect(client).not.toContain('enabled');
  });

  it('passes a non-literal multiTabSync value through and warns about it', async () => {
    const { client, report } = await run(
      auth(`{ name: 'auth', queryClientRef: CLIENT, queries: [], multiTabSync: syncConfig }`),
    );

    expect(client).toContain(`features: [withBearerAuthMultiTabSync(syncConfig)]`);
    expect(report).toContain('multiTabSync value is not a literal');
  });

  it('spreads a features value that is not an array literal', async () => {
    const { client } = await run(
      `import { createQueryClient } from '@ethlete/query';\n\nexport const CLIENT = createQueryClient({ name: 'api', baseUrl: 'x', features: sharedFeatures });\n`,
    );

    expect(client).toContain('features: [...sharedFeatures, withEthleteApiErrors()]');
  });

  it('names the auth feature when an auth provider config cannot be read', async () => {
    const { client, report } = await run(auth('authConfig'));

    expect(client).toContain('createBearerAuthProvider(authConfig)');
    expect(report).toContain('createBearerAuthProvider called with a non-literal config');
    expect(report).toContain('Add `withBearerAuthMultiTabSync()`');
  });

  it('reports spread configs instead of rewriting them', async () => {
    const source = `import { createBearerAuthProvider, createQueryClient } from '@ethlete/query';\n\nexport const CLIENT = createQueryClient({ ...baseClient, name: 'api' });\n\nexport const AUTH = createBearerAuthProvider({ ...baseAuth, name: 'auth' });\n`;
    const { client, report } = await run(source);

    expect(client).toBe(source);
    expect(report).toContain('createQueryClient config spreads another object');
    expect(report).toContain('add `withEthleteApiErrors()`');
    expect(report).toContain('createBearerAuthProvider config spreads another object');
    expect(report).toContain('add `withBearerAuthMultiTabSync()`');
  });

  it('migrates a client and an auth provider declared in the same file', async () => {
    const { client } = await run(
      `import { createBearerAuthProvider, createQueryClient } from '@ethlete/query';\n\nexport const CLIENT = createQueryClient({ name: 'api', baseUrl: 'x' });\n\nexport const AUTH = createBearerAuthProvider({ name: 'auth', queryClientRef: CLIENT, queries: [] });\n`,
    );

    expect(client).toContain(`createQueryClient({ name: 'api', baseUrl: 'x', features: [withEthleteApiErrors()] })`);
    expect(client).toContain(
      `createBearerAuthProvider({ name: 'auth', queryClientRef: CLIENT, queries: [], features: [withBearerAuthMultiTabSync()] })`,
    );
    expect(client).toContain(
      `import { createBearerAuthProvider, createQueryClient, withBearerAuthMultiTabSync, withEthleteApiErrors } from '@ethlete/query';`,
    );
  });

  it('leaves files without a client or auth provider untouched', async () => {
    const source = `export const nothing = 1;\n`;
    const { client, report } = await run(source);

    expect(client).toBe(source);
    expect(report).toContain('No open follow-up tasks');
  });
  it('groups repeated findings into one task and lists every location', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
      // noop
    });

    const { report } = await run(
      `import { createBearerAuthProvider, createQueryClient } from '@ethlete/query';\n\nexport const API = createQueryClient({ name: 'api', baseUrl: 'a' });\nexport const CMS = createQueryClient({ name: 'cms', baseUrl: 'b' });\nexport const AUTH = createBearerAuthProvider({ name: 'auth', queryClientRef: API, queries: [] });\n`,
    );

    expect(report).toContain('QOF-001 - Client kept the full error pipeline');
    expect(report).toContain('QOF-002 - Auth provider kept multi-tab sync');
    expect(report).not.toContain('QOF-003');
    expect(report).toContain('- client.ts:3\n- client.ts:4');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Generated 2 follow-up tasks'));
  });
});
