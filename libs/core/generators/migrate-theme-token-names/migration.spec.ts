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

  const logged = () =>
    vi
      .mocked(console.log)
      .mock.calls.map((call) => call.join(' '))
      .join('\n');

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
    expect(logged()).toContain('Regenerate your theme CSS with `nx g @ethlete/core:tailwind-4-color-theme`');
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

  it('prints no regenerate hint when nothing changed', async () => {
    tree.write('apps/web/src/app.html', '<a class="p-4"></a>');

    await migrateThemeTokenNames(tree, { skipFormat: true });

    expect(logged()).toContain('Nothing to rename.');
    expect(logged()).not.toContain('Regenerate');
  });

  it('renames the Studio design files in a scoped run too', async () => {
    tree.write('apps/app-a/src/app.css', 'a {\n  color: var(--et-surface-color-muted-solid);\n}\n');
    tree.write('apps/app-b/src/app.css', 'a {\n  color: var(--et-surface-color-muted-solid);\n}\n');
    tree.write(
      '.ethlete/design/app-a/components/card/card.css',
      '.card {\n  color: var(--et-surface-color-muted-solid);\n}\n',
    );

    await migrateThemeTokenNames(tree, { skipFormat: true, include: ['apps/app-a'] });

    expect(tree.read('apps/app-a/src/app.css', 'utf-8')).toBe('a {\n  color: var(--et-surface-text-muted);\n}\n');
    expect(tree.read('apps/app-b/src/app.css', 'utf-8')).toBe(
      'a {\n  color: var(--et-surface-color-muted-solid);\n}\n',
    );
    expect(tree.read('.ethlete/design/app-a/components/card/card.css', 'utf-8')).toBe(
      '.card {\n  color: var(--et-surface-text-muted);\n}\n',
    );
  });
});
