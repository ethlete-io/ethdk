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
});
