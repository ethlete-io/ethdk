import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateSemanticColorThemeInjects from './migration';
import { migrateSemanticColorThemeInjectsInFile } from './semantic-color-theme-injects';

const STATUS_ICON = `import { Component, input, ViewEncapsulation } from '@angular/core';
import {
  ColorTheme,
  injectErrorTheme,
  injectSuccessTheme,
  injectWarningTheme,
  ProvideColorDirective,
} from '@ethlete/core';

@Component({
  selector: 'app-status-icon',
  template: \`<span [etProvideColor]="toneThemes[tone()]"></span>\`,
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective],
})
export class StatusIconComponent {
  public tone = input.required<'pending' | 'success' | 'warning' | 'error'>();

  protected toneThemes: Record<'pending' | 'success' | 'warning' | 'error', ColorTheme | null> = {
    pending: null,
    success: injectSuccessTheme(),
    warning: injectWarningTheme(),
    error: injectErrorTheme(),
  };
}
`;

const CONFIRM_DIALOG = `import { booleanAttribute, Component, computed, input } from '@angular/core';
import { injectErrorTheme } from '@ethlete/core';

@Component({ selector: 'app-confirm-dialog', template: '' })
export class ConfirmDialogComponent {
  public destructive = input(false, { transform: booleanAttribute });

  private errorTheme = injectErrorTheme();

  protected confirmColor = computed(() => (this.destructive() ? this.errorTheme : null));
}
`;

describe('migrateSemanticColorThemeInjectsInFile', () => {
  it('rewrites a record of the three injects and swaps the imports', () => {
    const result = migrateSemanticColorThemeInjectsInFile('status-icon.component.ts', STATUS_ICON);

    expect(result.findings).toEqual([]);
    expect(result.content).toContain("success: injectSemanticColorTheme('success')(),");
    expect(result.content).toContain("warning: injectSemanticColorTheme('warning')(),");
    expect(result.content).toContain("error: injectSemanticColorTheme('error')(),");
    expect(result.content).not.toMatch(/inject(Error|Warning|Success)Theme/);
    expect(result.content).toMatch(/import \{[^}]*\binjectSemanticColorTheme\b[^}]*\} from '@ethlete\/core'/);
    expect(result.content).toMatch(/import \{[^}]*\bProvideColorDirective\b[^}]*\} from '@ethlete\/core'/);
  });

  it('rewrites a field that held the theme and keeps its ColorTheme value', () => {
    const result = migrateSemanticColorThemeInjectsInFile('confirm-dialog.component.ts', CONFIRM_DIALOG);

    expect(result.content).toContain("private errorTheme = injectSemanticColorTheme('error')();");
    expect(result.content).toContain("import { injectSemanticColorTheme } from '@ethlete/core';");
    expect(result.content).toContain('this.destructive() ? this.errorTheme : null');
  });

  it('reuses an existing injectSemanticColorTheme import and alias', () => {
    const result = migrateSemanticColorThemeInjectsInFile(
      'a.ts',
      `import { injectSemanticColorTheme as semantic, injectWarningTheme as warn } from '@ethlete/core';
const a = warn();
const b = semantic('error');
`,
    );

    expect(result.content).toContain("import { injectSemanticColorTheme as semantic } from '@ethlete/core';");
    expect(result.content).toContain("const a = semantic('warning')();");
  });

  it('reports a use that is not a call and leaves the file as it was', () => {
    const content = `import { injectErrorTheme } from '@ethlete/core';
const factories = [injectErrorTheme];
`;
    const result = migrateSemanticColorThemeInjectsInFile('a.ts', content);

    expect(result.changed).toBe(false);
    expect(result.content).toBe(content);
    expect(result.findings).toEqual([
      expect.objectContaining({ line: 2, reason: expect.stringContaining("injectSemanticColorTheme('error')") }),
    ]);
  });

  it('leaves a same-named function from another module alone', () => {
    const content = `import { injectErrorTheme } from './local';
const theme = injectErrorTheme();
`;

    expect(migrateSemanticColorThemeInjectsInFile('a.ts', content).changed).toBe(false);
  });
});

describe('migrateSemanticColorThemeInjects', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('apps/app-a/src/app/status-icon.component.ts', STATUS_ICON);
    tree.write('libs/app-b/src/lib/confirm-dialog.component.ts', CONFIRM_DIALOG);
  });

  it('migrates both apps and needs no hand fix', async () => {
    const callback = await migrateSemanticColorThemeInjects(tree, { skipFormat: true });

    expect(callback).toBeUndefined();
    expect(tree.read('apps/app-a/src/app/status-icon.component.ts', 'utf-8')).not.toMatch(/inject(Error|Success)Theme/);
    expect(tree.read('libs/app-b/src/lib/confirm-dialog.component.ts', 'utf-8')).toContain(
      "injectSemanticColorTheme('error')()",
    );
  });

  it('is a no-op on a second run', async () => {
    await migrateSemanticColorThemeInjects(tree, { skipFormat: true });
    const once = tree.read('apps/app-a/src/app/status-icon.component.ts', 'utf-8');
    await migrateSemanticColorThemeInjects(tree, { skipFormat: true });

    expect(tree.read('apps/app-a/src/app/status-icon.component.ts', 'utf-8')).toBe(once);
  });
});
