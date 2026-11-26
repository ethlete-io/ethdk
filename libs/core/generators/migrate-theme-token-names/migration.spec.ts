import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateThemeTokenNames from './migration';

describe('migrate-theme-token-names', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('renames the Tailwind names it reads from a generated theme file', async () => {
    tree.write(
      'libs/theme/generated-color-themes.css',
      `/*
 * nx g @ethlete/core:tailwind-4-color-theme --prefix=aa --runtimePrefix=et
 */
@theme {
  /* brand theme */
  --color-aa-brand: rgb(1 2 3);
}`,
    );
    tree.write('apps/web/src/app.html', '<a class="bg-aa-brand hover:text-aa-on-theme-hover"></a>');

    const task = await migrateThemeTokenNames(tree, { skipFormat: true });

    expect(task).toBeUndefined();
    expect(tree.read('apps/web/src/app.html', 'utf-8')).toBe(
      '<a class="bg-aa-tone-brand-fill hover:text-aa-tone-on-fill-hover"></a>',
    );
  });

  it('writes what it can and fails with file and line for the rest', async () => {
    tree.write(
      'apps/web/src/button.css',
      `.button {
  color: rgb(var(--et-color-primary));
  &:hover {
    --et-theme-color-primary-rgb: var(--et-color-primary-hover);
  }
}`,
    );

    const task = await migrateThemeTokenNames(tree, { skipFormat: true });

    expect(tree.read('apps/web/src/button.css', 'utf-8')).toContain('color: var(--et-tone-fill-rest);');
    expect(task).toBeTypeOf('function');
    expect(() => task?.()).toThrow(
      /apps\/web\/src\/button\.css:4: --et-theme-color-primary-rgb is reassigned without --et-theme-color-primary-solid/,
    );
  });
});
