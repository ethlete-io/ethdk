import { Provider } from '@angular/core';
import { createRichTextEditorTokenCodec } from './headless/internals/rich-text-editor-token';
import { RICH_TEXT_EDITOR_TOKEN_CODEC } from './rich-text-editor-token-codec.token';
import { RichTextEditorTrigger } from './rich-text-editor-trigger';

/**
 * Renders stored `{{type:id}}` tokens as labelled chips in a display/read-only editor without
 * pulling in the interactive trigger machinery (detection, popup, floating-ui). Provide it on the
 * component/route that shows editor values, passing the same triggers used to author them (only
 * `type` and `resolveItem` are consulted here).
 *
 * ```ts
 * providers: [provideRichTextEditorTokenRendering([
 *   createRichTextEditorTrigger({ char: '#', type: 'block', items: [], resolveItem: id => byId(id) }),
 * ])]
 * ```
 */
export const provideRichTextEditorTokenRendering = (triggers: readonly RichTextEditorTrigger[]): Provider[] => [
  { provide: RICH_TEXT_EDITOR_TOKEN_CODEC, useValue: createRichTextEditorTokenCodec(() => triggers) },
];
