import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('migrate-to-query-v3 migration scope', () => {
  let tree: Tree;
  let log: ReturnType<typeof vi.spyOn>;

  const readOrEmpty = (path: string) => tree.read(path, 'utf-8') ?? '';

  const writeClient = (root: string) => {
    tree.write(
      `${root}/client.ts`,
      "import { V2QueryClient } from '@ethlete/query';\n\nexport const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });",
    );
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    log = vi.spyOn(console, 'log').mockImplementation(() => {
      // noop
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {
      // noop
    });

    writeClient('libs/inside');
    writeClient('libs/outside');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('only migrates files under an included path given with a trailing slash', async () => {
    await migration(tree, { skipFormat: true, include: ['libs/inside/'] });

    expect(log).toHaveBeenCalledWith('   Scope: libs/inside');
    expect(readOrEmpty('libs/inside/client.ts')).toContain('createQueryClient');
    expect(readOrEmpty('libs/outside/client.ts')).toContain('new V2QueryClient');
  });

  it('describes the whole workspace when no scope is given', async () => {
    await migration(tree, { skipFormat: true });

    expect(log).toHaveBeenCalledWith('   Scope: the whole workspace');
    expect(readOrEmpty('libs/outside/client.ts')).toContain('createQueryClient');
  });

  it('keeps the report of an earlier scoped run when another scope is migrated', async () => {
    await migration(tree, { skipFormat: true, include: ['libs/inside'] });
    await migration(tree, { skipFormat: true, include: ['libs/outside'] });

    const report = readOrEmpty('query-v3-migration-tasks.md');

    expect(report).toContain('## Tasks (scope: libs/inside)');
    expect(report).toContain('## Tasks (scope: libs/outside)');
    expect(report).toContain('- libs/inside/client.ts');
    expect(report).toContain('- libs/outside/client.ts');
    expect(report.match(/# Query V3 Migration Follow-Up/g)).toHaveLength(1);
    expect(new Set(report.match(/### QV3-\d+/g)).size).toBe(report.match(/### QV3-\d+/g)!.length);
  });

  it('replaces the section of a re-run scope instead of appending it twice', async () => {
    await migration(tree, { skipFormat: true, include: ['libs/inside'] });
    await migration(tree, { skipFormat: true, include: ['libs/inside'] });

    expect(readOrEmpty('query-v3-migration-tasks.md').match(/## Tasks \(scope: libs\/inside\)/g)).toHaveLength(1);
  });
});
