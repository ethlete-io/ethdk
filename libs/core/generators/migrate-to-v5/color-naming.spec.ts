import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateColorNaming from './color-naming.js';

describe('migrate-to-v6 -> color naming migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should rename ProvideThemeDirective to ProvideColorDirective in imports', async () => {
    tree.write(
      'src/app.component.ts',
      `import { ProvideThemeDirective, THEME_PROVIDER } from '@ethlete/core';

@Component({
  hostDirectives: [{ directive: ProvideThemeDirective, inputs: ['etProvideTheme:theme'] }],
})
export class AppComponent {}`,
    );

    await migrateColorNaming(tree);

    const result = tree.read('src/app.component.ts', 'utf-8');
    expect(result).toContain('ProvideColorDirective');
    expect(result).toContain('COLOR_PROVIDER');
    expect(result).not.toContain('ProvideThemeDirective');
    expect(result).not.toContain('THEME_PROVIDER');
    expect(result).toContain("'etProvideColor:color'");
    expect(result).not.toContain("'etProvideTheme:theme'");
  });

  it('should rename ColorThemedDirective to ColorInteractiveDirective', async () => {
    tree.write(
      'src/my.component.ts',
      `import { ColorThemedDirective } from '@ethlete/core';

@Component({
  hostDirectives: [ColorThemedDirective],
})
export class MyComponent {}`,
    );

    await migrateColorNaming(tree);

    const result = tree.read('src/my.component.ts', 'utf-8');
    expect(result).toContain('ColorInteractiveDirective');
    expect(result).not.toContain('ColorThemedDirective');
  });

  it('should rename SurfaceThemedDirective to SurfaceInteractiveDirective', async () => {
    tree.write(
      'src/my.component.ts',
      `import { SurfaceThemedDirective } from '@ethlete/core';

@Component({
  hostDirectives: [SurfaceThemedDirective],
})
export class MyComponent {}`,
    );

    await migrateColorNaming(tree);

    const result = tree.read('src/my.component.ts', 'utf-8');
    expect(result).toContain('SurfaceInteractiveDirective');
    expect(result).not.toContain('SurfaceThemedDirective');
  });

  it('should update template bindings', async () => {
    tree.write(
      'src/my.component.html',
      `<et-button [theme]="brand" [altTheme]="alt" etProvideTheme="brand"></et-button>`,
    );

    await migrateColorNaming(tree);

    const result = tree.read('src/my.component.html', 'utf-8');
    expect(result).toContain('[theme]="brand"');
    expect(result).toContain('[altTheme]="alt"');
    expect(result).toContain('etProvideColor="brand"');
    expect(result).not.toContain('etProvideTheme');
  });

  it('should update CSS class names', async () => {
    tree.write(
      'src/styles.css',
      `.et-color-themed { color: red; }
.et-surface-themed { background: blue; }
.et-theme--brand { --x: 1; }
.et-theme-alt--brand { --y: 2; }`,
    );

    await migrateColorNaming(tree);

    const result = tree.read('src/styles.css', 'utf-8');
    expect(result).toContain('.et-color-interactive');
    expect(result).toContain('.et-surface-interactive');
    expect(result).toContain('.et-color--brand');
    expect(result).toContain('.et-color-alt--brand');
    expect(result).not.toContain('.et-color-themed');
    expect(result).not.toContain('.et-surface-themed');
    expect(result).not.toContain('.et-theme--');
    expect(result).not.toContain('.et-theme-alt--');
  });

  it('should modify spec files', async () => {
    tree.write('src/test.spec.ts', `import { ProvideThemeDirective } from '@ethlete/core';`);

    await migrateColorNaming(tree);

    const result = tree.read('src/test.spec.ts', 'utf-8');
    expect(result).toContain('ProvideColorDirective');
  });

  it('should not modify files without relevant content', async () => {
    const content = `import { Component } from '@angular/core';`;
    tree.write('src/empty.ts', content);

    await migrateColorNaming(tree);

    const result = tree.read('src/empty.ts', 'utf-8');
    expect(result).toBe(content);
  });
});
