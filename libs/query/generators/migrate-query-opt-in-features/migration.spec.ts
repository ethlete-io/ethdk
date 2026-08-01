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
});
