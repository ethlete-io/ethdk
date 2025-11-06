import { BLOCKS, INLINES } from '@contentful/rich-text-types';
import { isObject } from '@ethlete/core';
import { RichTextResponse } from '../../types';

export const isRichTextRootNode = (node: unknown): node is RichTextResponse => {
  return isObject(node) && 'nodeType' in node && node['nodeType'] === 'document';
};

export const translateContentfulNodeTypeToHtmlTag = (nodeType: 'text' | BLOCKS | INLINES) => {
  switch (nodeType) {
    case BLOCKS.HEADING_1:
      return 'h1';
    case BLOCKS.HEADING_2:
      return 'h2';
    case BLOCKS.HEADING_3:
      return 'h3';
    case BLOCKS.HEADING_4:
      return 'h4';
    case BLOCKS.HEADING_5:
      return 'h5';
    case BLOCKS.HEADING_6:
      return 'h6';
    case BLOCKS.PARAGRAPH:
      return 'p';
    case BLOCKS.UL_LIST:
      return 'ul';
    case BLOCKS.OL_LIST:
      return 'ol';
    case BLOCKS.LIST_ITEM:
      return 'li';
    case BLOCKS.HR:
      return 'hr';
    case BLOCKS.QUOTE:
      return 'blockquote';
    case BLOCKS.TABLE:
      return 'table';
    case BLOCKS.TABLE_ROW:
      return 'tr';
    case BLOCKS.TABLE_CELL:
      return 'td';
    case BLOCKS.TABLE_HEADER_CELL:
      return 'th';
    case BLOCKS.EMBEDDED_ASSET:
      return 'div';

    case INLINES.HYPERLINK:
      return 'a';
    case INLINES.ENTRY_HYPERLINK:
      return 'a';
    case INLINES.ASSET_HYPERLINK:
      return 'a';

    case 'text':
      return 'span';

    // Will be ignored by the renderer
    case 'document':
      return 'document';

    case BLOCKS.EMBEDDED_ENTRY:
      return 'div';
    case INLINES.EMBEDDED_ENTRY:
      return 'div';

    default:
      return 'div';
  }
};
