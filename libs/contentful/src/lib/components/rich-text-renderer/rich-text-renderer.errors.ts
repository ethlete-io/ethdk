import { RuntimeError } from '@ethlete/core';

export const RICH_TEXT_RENDERER_ERRORS = {
  rich_text_not_object: (data: { type: string }) =>
    `The value at richTextPath is a ${data.type}, not a rich-text document object. Point richTextPath at the rich-text field itself (e.g. items[0].fields.body).`,
  rich_text_wrong_type:
    'The rich text object does not satisfy the RichTextResponse interface. It should contain a property named "nodeType" with the value "document".',

  rich_text_conflicting_inputs:
    'gqlRichText cannot be combined with content or richTextPath. Pass either a GraphQL rich-text field through gqlRichText, or a REST response through content and richTextPath.',

  asset_id_not_found: 'The asset ID was not found. This node is not supported.',
  entry_id_not_found: 'The entry ID was not found. This node is not supported.',

  text_parent_not_found: 'The parent node is not found. This structure is not supported.',

  cached_command_not_found: 'No rendered node was found for a render command. The renderer state is out of sync.',
  cached_command_not_component:
    'The rendered node for a component command is not a component. The renderer state is out of sync.',
} as const;

const RICH_TEXT_RENDERER_ERROR_CODES: Record<keyof typeof RICH_TEXT_RENDERER_ERRORS, number> = {
  rich_text_not_object: 0,
  rich_text_wrong_type: 1,
  rich_text_conflicting_inputs: 11,
  asset_id_not_found: 2,
  entry_id_not_found: 3,
  text_parent_not_found: 7,
  cached_command_not_found: 9,
  cached_command_not_component: 10,
};

export const richTextRendererError = (code: keyof typeof RICH_TEXT_RENDERER_ERRORS, data?: unknown) => {
  const entry: string | ((data: never) => string) = RICH_TEXT_RENDERER_ERRORS[code];
  const message = `<et-contentful-rich-text-renderer>: ${typeof entry === 'function' ? entry(data as never) : entry}`;

  throw new RuntimeError(RICH_TEXT_RENDERER_ERROR_CODES[code], message, data);
};
