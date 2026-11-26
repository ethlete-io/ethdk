import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('migrate-to-query-v3 orchestration', () => {
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

  it('should skip formatting when skipFormat is true and still emit a report file', async () => {
    tree.write(
      'test.ts',
      `
import { Foo    } from '@somewhere';
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    expect(tree.read('test.ts', 'utf-8')).toContain('Foo   ');
    expect(tree.read('query-v3-migration-tasks.md', 'utf-8')).toContain('No open follow-up tasks');
  });
});
