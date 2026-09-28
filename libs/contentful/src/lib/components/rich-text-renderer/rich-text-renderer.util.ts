import { isDevMode } from '@angular/core';
import { BLOCKS, INLINES } from '@contentful/rich-text-types';
import { isObject } from '@ethlete/core';
import { RichTextResponse } from '../../types';
import { CF_BLOCKS, CF_INLINES } from './rich-text-node-types';

export const isRichTextRootNode = (node: unknown): node is RichTextResponse => {
  return isObject(node) && 'nodeType' in node && node['nodeType'] === 'document';
};

const NODE_TYPE_TAGS: Record<string, keyof HTMLElementTagNameMap> = {
  [CF_BLOCKS.HEADING_1]: 'h1',
  [CF_BLOCKS.HEADING_2]: 'h2',
  [CF_BLOCKS.HEADING_3]: 'h3',
  [CF_BLOCKS.HEADING_4]: 'h4',
  [CF_BLOCKS.HEADING_5]: 'h5',
  [CF_BLOCKS.HEADING_6]: 'h6',
  [CF_BLOCKS.PARAGRAPH]: 'p',
  [CF_BLOCKS.UL_LIST]: 'ul',
  [CF_BLOCKS.OL_LIST]: 'ol',
  [CF_BLOCKS.LIST_ITEM]: 'li',
  [CF_BLOCKS.HR]: 'hr',
  [CF_BLOCKS.QUOTE]: 'blockquote',
  [CF_BLOCKS.TABLE]: 'table',
  [CF_BLOCKS.TABLE_ROW]: 'tr',
  [CF_BLOCKS.TABLE_CELL]: 'td',
  [CF_BLOCKS.TABLE_HEADER_CELL]: 'th',
};

const INLINE_NODE_TYPES = new Set<string>(Object.values(CF_INLINES));

/**
 * The html element a structural rich text node renders as. A node type without an element
 * (an unsupported inline or block) falls back to `span` for inlines and `div` otherwise,
 * with a dev-mode warning.
 */
export const translateContentfulNodeTypeToHtmlTag = (
  nodeType: 'text' | BLOCKS | INLINES,
): keyof HTMLElementTagNameMap => {
  const tag = NODE_TYPE_TAGS[nodeType];

  if (tag) {
    return tag;
  }

  const fallback = INLINE_NODE_TYPES.has(nodeType) ? 'span' : 'div';

  if (isDevMode()) {
    console.warn(`Unsupported rich text node type "${nodeType}"! Its content is rendered inside a <${fallback}>.`);
  }

  return fallback;
};
