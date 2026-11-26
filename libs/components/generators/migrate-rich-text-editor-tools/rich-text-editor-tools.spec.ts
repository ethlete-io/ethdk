import { describe, expect, it } from 'vitest';
import { scanRichTextEditorToolsInFile } from './rich-text-editor-tools';

describe('migrate-rich-text-editor-tools', () => {
  it('reports a template using et-rich-text-editor', () => {
    const { usages, hasToolProvider } = scanRichTextEditorToolsInFile(
      'apps/shop/src/app/post.component.html',
      '<et-form-field>\n<et-rich-text-editor [formField]="body" />\n</et-form-field>',
    );

    expect(hasToolProvider).toBe(false);
    expect(usages).toEqual([
      {
        id: 'rich-text-editor-tools--apps-shop-src-app-post-component-html',
        file: 'apps/shop/src/app/post.component.html',
        line: 2,
        message: expect.stringContaining('et-rich-text-editor'),
      },
    ]);
  });

  it('reports imports-barrel usage in TS', () => {
    const { usages } = scanRichTextEditorToolsInFile(
      'apps/shop/src/app/post.component.ts',
      "import { RICH_TEXT_EDITOR_IMPORTS } from '@ethlete/components';",
    );

    expect(usages).toHaveLength(1);
    expect(usages[0]?.message).toContain('RICH_TEXT_EDITOR_IMPORTS');
  });

  it.each([
    'provideRichTextEditorDefaultTools',
    'provideRichTextEditorHeadingTool',
    'provideRichTextEditorBlockquoteTool',
    'provideRichTextEditorCodeBlockTool',
    'provideRichTextEditorLinkTool',
    'provideRichTextEditorAutoformat',
  ])('treats %s as already opted in', (provider) => {
    const { hasToolProvider } = scanRichTextEditorToolsInFile(
      'apps/shop/src/app/app.config.ts',
      `providers: [${provider}()],`,
    );

    expect(hasToolProvider).toBe(true);
  });

  it('does not mistake the link editor popover for a tool provider', () => {
    const { hasToolProvider } = scanRichTextEditorToolsInFile(
      'apps/shop/src/app/app.config.ts',
      'providers: [provideRichTextEditorLinkEditor()],',
    );

    expect(hasToolProvider).toBe(false);
  });

  it('ignores unrelated files', () => {
    const { usages, hasToolProvider } = scanRichTextEditorToolsInFile(
      'apps/shop/src/app/other.ts',
      'export const nothing = 1;',
    );

    expect(usages).toHaveLength(0);
    expect(hasToolProvider).toBe(false);
  });
});
