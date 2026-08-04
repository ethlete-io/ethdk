import { describe, expect, it } from 'vitest';
import { scanRichTextEditorFloatingToolbarInFile } from './rich-text-editor-floating-toolbar';

describe('migrate-rich-text-editor-floating-toolbar', () => {
  it('reports a template using et-rich-text-editor', () => {
    const { usages, hasFloatingToolbarProvider } = scanRichTextEditorFloatingToolbarInFile(
      'apps/shop/src/app/post.component.html',
      '<et-form-field>\n<et-rich-text-editor [formField]="body" />\n</et-form-field>',
    );

    expect(hasFloatingToolbarProvider).toBe(false);
    expect(usages).toEqual([
      {
        id: 'rich-text-editor-floating-toolbar--apps-shop-src-app-post-component-html',
        file: 'apps/shop/src/app/post.component.html',
        line: 2,
        message: expect.stringContaining('et-rich-text-editor'),
      },
    ]);
  });

  it('reports imports-barrel usage in TS', () => {
    const { usages } = scanRichTextEditorFloatingToolbarInFile(
      'apps/shop/src/app/post.component.ts',
      "import { RICH_TEXT_EDITOR_IMPORTS } from '@ethlete/components';",
    );

    expect(usages).toHaveLength(1);
    expect(usages[0]?.message).toContain('RICH_TEXT_EDITOR_IMPORTS');
  });

  it('detects an existing selection toolbar provider', () => {
    const { hasFloatingToolbarProvider } = scanRichTextEditorFloatingToolbarInFile(
      'apps/shop/src/app/app.config.ts',
      'providers: [provideRichTextEditorFloatingToolbar()],',
    );

    expect(hasFloatingToolbarProvider).toBe(true);
  });

  it('ignores unrelated files', () => {
    const { usages, hasFloatingToolbarProvider } = scanRichTextEditorFloatingToolbarInFile(
      'apps/shop/src/app/other.ts',
      'export const nothing = 1;',
    );

    expect(usages).toHaveLength(0);
    expect(hasFloatingToolbarProvider).toBe(false);
  });
});
