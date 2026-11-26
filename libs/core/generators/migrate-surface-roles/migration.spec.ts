import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateSurfaceRoles from './migration';

describe('migrate-surface-roles', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('renames the Studio design files in a scoped run too', async () => {
    tree.write('apps/app-a/src/row.html', '<li class="hover:bg-et-surface-interaction/9"></li>');
    tree.write('apps/app-b/src/row.html', '<li class="hover:bg-et-surface-interaction/9"></li>');
    tree.write(
      '.ethlete/design/app-a/components/row/row.ts',
      'export const row = `<li class="hover:bg-et-surface-interaction/9 active:bg-et-surface-interaction/15"></li>`;\n',
    );

    await migrateSurfaceRoles(tree, { skipFormat: true, include: ['apps/app-a'] });

    expect(tree.read('apps/app-a/src/row.html', 'utf-8')).toBe('<li class="hover:bg-et-surface-tint/9"></li>');
    expect(tree.read('apps/app-b/src/row.html', 'utf-8')).toBe('<li class="hover:bg-et-surface-interaction/9"></li>');
    expect(tree.read('.ethlete/design/app-a/components/row/row.ts', 'utf-8')).toBe(
      'export const row = `<li class="hover:bg-et-surface-tint/9 active:bg-et-surface-tint/15"></li>`;\n',
    );
  });
});
