import { RuntimeError } from '@ethlete/core';

export const RICH_TEXT_RENDERER_ERRORS = {
  rich_text_undefined:
    'The property value given at richTextPath is undefined. Use the richTextPath input to specify the path to the rich text object.',
  rich_text_wrong_type:
    'The rich text object does not satisfy the RichTextResponse interface. It should contain a property named "nodeType" with the value "document".',

  asset_id_not_found: 'The asset ID was not found. This node is not supported.',
  entry_id_not_found: 'The entry ID was not found. This node is not supported.',

  asset_not_found: 'The asset was not found. This node is not supported.',
  entry_not_found: 'The entry was not found. This node is not supported.',

  custom_component_not_found: 'No custom component found for entry type. Please provide one for this type.',

  text_parent_not_found: 'The parent node is not found. This structure is not supported.',
  text_parent_wrong_type:
    'The parent node neither a html element nor a custom component. This structure is not supported.',

  cached_command_not_found: 'No rendered node was found for a render command. The renderer state is out of sync.',
  cached_command_not_component:
    'The rendered node for a component command is not a component. The renderer state is out of sync.',
  command_not_found: 'A render command preceding the current one is missing. The renderer state is out of sync.',
} as const;

const RICH_TEXT_RENDERER_ERROR_CODES: Record<keyof typeof RICH_TEXT_RENDERER_ERRORS, number> = {
  rich_text_undefined: 0,
  rich_text_wrong_type: 1,
  asset_id_not_found: 2,
  entry_id_not_found: 3,
  asset_not_found: 4,
  entry_not_found: 5,
  custom_component_not_found: 6,
  text_parent_not_found: 7,
  text_parent_wrong_type: 8,
  cached_command_not_found: 9,
  cached_command_not_component: 10,
  command_not_found: 11,
};

export const richTextRendererError = (code: keyof typeof RICH_TEXT_RENDERER_ERRORS, data?: unknown) => {
  const message = `<et-contentful-rich-text-renderer>: ${RICH_TEXT_RENDERER_ERRORS[code]}`;

  throw new RuntimeError(RICH_TEXT_RENDERER_ERROR_CODES[code], message, data);
};
