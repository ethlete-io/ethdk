import { inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { RICH_TEXT_EDITOR_ERROR_CODES } from '../../rich-text-editor-errors';
import { RICH_TEXT_EDITOR_TOOL, RichTextEditorToolDefinition } from '../../rich-text-editor-tools';

export const injectRegisteredRichTextEditorTools = (): readonly RichTextEditorToolDefinition[] => {
  const registered: unknown = inject(RICH_TEXT_EDITOR_TOOL, { optional: true }) ?? [];

  if (Array.isArray(registered)) return registered;

  if (ngDevMode) {
    throw new RuntimeError(
      RICH_TEXT_EDITOR_ERROR_CODES.TOOL_NOT_MULTI_PROVIDED,
      `RICH_TEXT_EDITOR_TOOL was provided without \`multi: true\`. Register custom tools with provideRichTextEditorTool(definition).`,
    );
  }

  return [registered as RichTextEditorToolDefinition];
};
