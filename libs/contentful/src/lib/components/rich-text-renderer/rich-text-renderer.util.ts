import { BLOCKS, INLINES } from '@contentful/rich-text-types';
import { isObject } from '@ethlete/core';
import { RichTextResponse } from '../../types';
import { CF_BLOCKS, CF_INLINES } from './rich-text-node-types';

export const isRichTextRootNode = (node: unknown): node is RichTextResponse => {
  return isObject(node) && 'nodeType' in node && node['nodeType'] === 'document';
};

export const translateContentfulNodeTypeToHtmlTag = (nodeType: 'text' | BLOCKS | INLINES) => {
  switch (nodeType) {
    case CF_BLOCKS.HEADING_1:
      return 'h1';
    case CF_BLOCKS.HEADING_2:
      return 'h2';
    case CF_BLOCKS.HEADING_3:
      return 'h3';
    case CF_BLOCKS.HEADING_4:
      return 'h4';
    case CF_BLOCKS.HEADING_5:
      return 'h5';
    case CF_BLOCKS.HEADING_6:
      return 'h6';
    case CF_BLOCKS.PARAGRAPH:
      return 'p';
    case CF_BLOCKS.UL_LIST:
      return 'ul';
    case CF_BLOCKS.OL_LIST:
      return 'ol';
    case CF_BLOCKS.LIST_ITEM:
      return 'li';
    case CF_BLOCKS.HR:
      return 'hr';
    case CF_BLOCKS.QUOTE:
      return 'blockquote';
    case CF_BLOCKS.TABLE:
      return 'table';
    case CF_BLOCKS.TABLE_ROW:
      return 'tr';
    case CF_BLOCKS.TABLE_CELL:
      return 'td';
    case CF_BLOCKS.TABLE_HEADER_CELL:
      return 'th';
    case CF_BLOCKS.EMBEDDED_ASSET:
      return 'div';

    case CF_INLINES.ENTRY_HYPERLINK:
      return 'a';
    case CF_INLINES.ASSET_HYPERLINK:
      return 'a';

    case 'text':
      return 'span';

    // Will be ignored by the renderer
    case 'document':
      return 'div';

    case CF_BLOCKS.EMBEDDED_ENTRY:
      return 'div';
    case CF_INLINES.EMBEDDED_ENTRY:
      return 'div';

    default:
      return 'div';
  }
};
