import { describe, expect, it } from 'vitest';
import { scanRichTextEditorLinkEditorInFile } from './rich-text-editor-link-editor';

describe('migrate-rich-text-editor-link-editor', () => {
  it('reports a template using et-rich-text-editor', () => {
    const { usages, hasLinkEditorProvider } = scanRichTextEditorLinkEditorInFile(
      'apps/shop/src/app/post.component.html',
      '<et-form-field>\n<et-rich-text-editor [formField]="body" />\n</et-form-field>',
    );

    expect(hasLinkEditorProvider).toBe(false);
    expect(usages).toEqual([
      {
        id: 'rich-text-editor-link-editor--apps-shop-src-app-post-component-html',
        file: 'apps/shop/src/app/post.component.html',
        line: 2,
        message: expect.stringContaining('et-rich-text-editor'),
      },
    ]);
  });

  it('reports imports-barrel usage in TS', () => {
    const { usages } = scanRichTextEditorLinkEditorInFile(
      'apps/shop/src/app/post.component.ts',
      "import { RICH_TEXT_EDITOR_IMPORTS } from '@ethlete/components';",
    );

    expect(usages).toHaveLength(1);
    expect(usages[0]?.message).toContain('RICH_TEXT_EDITOR_IMPORTS');
  });

  it('detects an existing link editor provider', () => {
    const { hasLinkEditorProvider } = scanRichTextEditorLinkEditorInFile(
      'apps/shop/src/app/app.config.ts',
      'providers: [provideRichTextEditorLinkEditor()],',
    );

    expect(hasLinkEditorProvider).toBe(true);
  });

  it('ignores unrelated files', () => {
    const { usages, hasLinkEditorProvider } = scanRichTextEditorLinkEditorInFile(
      'apps/shop/src/app/other.ts',
      'export const nothing = 1;',
    );

    expect(usages).toHaveLength(0);
    expect(hasLinkEditorProvider).toBe(false);
  });
});
