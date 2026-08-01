import { BLOCKS, INLINES } from '@contentful/rich-text-types';

/**
 * The `BLOCKS` node type strings of `@contentful/rich-text-types`, as a plain literal map.
 * Keep the values in sync with the enum - they are part of the Contentful Delivery API.
 */
export const CF_BLOCKS = {
  DOCUMENT: 'document',
  PARAGRAPH: 'paragraph',
  HEADING_1: 'heading-1',
  HEADING_2: 'heading-2',
  HEADING_3: 'heading-3',
  HEADING_4: 'heading-4',
  HEADING_5: 'heading-5',
  HEADING_6: 'heading-6',
  OL_LIST: 'ordered-list',
  UL_LIST: 'unordered-list',
  LIST_ITEM: 'list-item',
  HR: 'hr',
  QUOTE: 'blockquote',
  EMBEDDED_ENTRY: 'embedded-entry-block',
  EMBEDDED_ASSET: 'embedded-asset-block',
  EMBEDDED_RESOURCE: 'embedded-resource-block',
  TABLE: 'table',
  TABLE_ROW: 'table-row',
  TABLE_CELL: 'table-cell',
  TABLE_HEADER_CELL: 'table-header-cell',
} as unknown as typeof BLOCKS;

/**
 * The `INLINES` node type strings of `@contentful/rich-text-types`, as a plain literal map.
 * Keep the values in sync with the enum - they are part of the Contentful Delivery API.
 */
export const CF_INLINES = {
  ASSET_HYPERLINK: 'asset-hyperlink',
  EMBEDDED_ENTRY: 'embedded-entry-inline',
  EMBEDDED_RESOURCE: 'embedded-resource-inline',
  ENTRY_HYPERLINK: 'entry-hyperlink',
  HYPERLINK: 'hyperlink',
  RESOURCE_HYPERLINK: 'resource-hyperlink',
} as unknown as typeof INLINES;
