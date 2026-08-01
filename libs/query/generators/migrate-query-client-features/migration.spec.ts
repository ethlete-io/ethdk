import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('migrate-query-client-features', () => {
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

  const run = async (content: string) => {
    tree.write('client.ts', content);
    await migration(tree, {});

    return {
      client: tree.read('client.ts', 'utf-8') ?? '',
      report: tree.read('query-client-features-migration-tasks.md', 'utf-8') ?? '',
    };
  };

  it('adds both features to a client that configured neither option', async () => {
    const { client } = await run(
      `import { createQueryClient } from '@ethlete/query';\n\nexport const CLIENT = createQueryClient({ baseUrl: 'https://api.example.com', name: 'api' });\n`,
    );

    expect(client).toContain('features: [withMultiTabSync(), withQueryPersistence()]');
    expect(client).toContain(
      `import { createQueryClient, withMultiTabSync, withQueryPersistence } from '@ethlete/query';`,
    );
  });

  it('drops a feature that was turned off and passes a config object through', async () => {
    const { client } = await run(
      `import { createQueryClient } from '@ethlete/query';\n\nexport const CLIENT = createQueryClient({\n  baseUrl: 'https://api.example.com',\n  name: 'api',\n  multiTabSync: false,\n  persistence: { maxAge: 1000 },\n});\n`,
    );

    expect(client).toContain('features: [withQueryPersistence({ maxAge: 1000 })]');
    expect(client).not.toContain('withMultiTabSync');
    expect(client).not.toContain('multiTabSync');
    expect(client).toContain(`import { createQueryClient, withQueryPersistence } from '@ethlete/query';`);
  });

  it('adds no features array when both options were off', async () => {
    const { client } = await run(
      `import { createQueryClient } from '@ethlete/query';\n\nexport const CLIENT = createQueryClient({\n  baseUrl: 'https://api.example.com',\n  name: 'api',\n  multiTabSync: false,\n  persistence: false,\n});\n`,
    );

    expect(client).not.toContain('features:');
    expect(client).not.toContain('persistence');
  });

  it('reports a non-literal config instead of rewriting it', async () => {
    const { client, report } = await run(
      `import { createQueryClient } from '@ethlete/query';\n\nconst config = { baseUrl: 'https://api.example.com', name: 'api' };\n\nexport const CLIENT = createQueryClient(config);\n`,
    );

    expect(client).toContain('createQueryClient(config)');
    expect(report).toContain('QCF-001');
    expect(report).toContain('non-literal config');
    expect(report).toContain('behavior preserving');
  });

  it('reports a spread config', async () => {
    const { report } = await run(
      `import { createQueryClient } from '@ethlete/query';\n\nexport const CLIENT = createQueryClient({ ...base, name: 'api' });\n`,
    );

    expect(report).toContain('spreads another object');
  });

  it('warns about an option value it cannot classify', async () => {
    const { client, report } = await run(
      `import { createQueryClient } from '@ethlete/query';\n\nexport const CLIENT = createQueryClient({ baseUrl: 'x', name: 'api', persistence: persistenceConfig });\n`,
    );

    expect(client).toContain('withQueryPersistence(persistenceConfig)');
    expect(report).toContain('not a literal');
  });

  it('leaves an existing features array alone', async () => {
    const { client, report } = await run(
      `import { createQueryClient, withMultiTabSync } from '@ethlete/query';\n\nexport const CLIENT = createQueryClient({ baseUrl: 'x', name: 'api', features: [withMultiTabSync()] });\n`,
    );

    expect(client).toContain('features: [withMultiTabSync()]');
    expect(report).toContain('already has a features array');
  });

  it('writes an empty report and skips formatting when asked', async () => {
    tree.write('unrelated.ts', `const a    = 1;\n`);

    await migration(tree, { skipFormat: true });

    expect(tree.read('unrelated.ts', 'utf-8')).toContain('a    = 1');
    expect(tree.read('query-client-features-migration-tasks.md', 'utf-8')).toContain('No open follow-up tasks');
  });
});
