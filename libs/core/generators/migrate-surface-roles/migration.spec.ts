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
  it('defines both the tint and the control text where a design file declares the old token', async () => {
    tree.write(
      '.ethlete/design/app-a/foundations/colors/colors.css',
      ':root {\n  --et-surface-interaction: #1c1f24;\n}\n.row { --et-surface-interaction: var(--et-surface-text); }\n',
    );
    tree.write(
      '.ethlete/design/app-a/components/sheet/sheet.css',
      '.sheet-item:hover {\n  background: color-mix(in srgb, var(--et-surface-interaction) 8%, transparent);\n  color: var(--et-surface-interaction);\n}\n',
    );

    await migrateSurfaceRoles(tree, { skipFormat: true, include: ['apps/app-a'] });

    expect(tree.read('.ethlete/design/app-a/foundations/colors/colors.css', 'utf-8')).toBe(
      ':root {\n  --et-surface-tint: #1c1f24;\n  --et-surface-control-text: #1c1f24;\n}\n' +
        '.row { --et-surface-tint: var(--et-surface-text); --et-surface-control-text: var(--et-surface-text); }\n',
    );
    expect(tree.read('.ethlete/design/app-a/components/sheet/sheet.css', 'utf-8')).toBe(
      '.sheet-item:hover {\n  background: color-mix(in srgb, var(--et-surface-tint) 8%, transparent);\n  color: var(--et-surface-control-text);\n}\n',
    );
  });

  it('warns with file and line for a hand fix without failing', async () => {
    tree.write('apps/app-a/src/a.css', '.a {\n  color: var(--et-surface-on-interaction);\n}\n');

    const task = await migrateSurfaceRoles(tree, { skipFormat: true });

    expect(task).toBeUndefined();
    const output = vi
      .mocked(console.log)
      .mock.calls.map((call) => call.join(' '))
      .join('\n');
    expect(output).toContain('WARN');
    expect(output).toMatch(/apps\/app-a\/src\/a\.css:2:/);
  });
});
