import { BLOCKS, INLINES, Mark } from '@contentful/rich-text-types';
import { ContentfulEntry, ContentfulRestAsset } from '../../types';
import {
  ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID,
  createContentfulIncludeMap,
  marksToClass,
  marksToTags,
} from './rich-text-renderer.component';
import { isRichTextRootNode, translateContentfulNodeTypeToHtmlTag } from './rich-text-renderer.util';

const mark = (type: string) => ({ type }) as Mark;

const createAsset = (id: string): ContentfulRestAsset => ({
  sys: { type: 'Asset', id, createdAt: '', updatedAt: '', locale: 'en-US' },
  fields: {
    title: id,
    description: '',
    file: { url: `//cdn/${id}.png`, details: { size: 1 }, fileName: `${id}.png`, contentType: 'image/png' },
  },
  metadata: { tags: [] },
});

const createEntry = (id: string, contentTypeId: string): ContentfulEntry => ({
  sys: {
    type: 'Entry',
    id,
    createdAt: '',
    updatedAt: '',
    locale: 'en-US',
    contentType: { sys: { type: 'Link', linkType: 'ContentType', id: contentTypeId } },
  },
  fields: { title: id },
  metadata: { tags: [] },
});

describe('marksToTags', () => {
  it('maps the known marks to their semantic elements', () => {
    expect(marksToTags([mark('bold'), mark('italic'), mark('underline'), mark('code')])).toEqual([
      'strong',
      'em',
      'u',
      'code',
    ]);
  });

  it('returns an empty array for no marks', () => {
    expect(marksToTags([])).toEqual([]);
  });

  it('warns and skips an unknown mark', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => void 0);

    expect(marksToTags([mark('bold'), mark('nope')])).toEqual(['strong']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('No element found for mark type');

    warn.mockRestore();
  });
});

describe('marksToClass', () => {
  it('maps marks to library mark classes', () => {
    expect(marksToClass([mark('bold'), mark('italic')])).toBe(
      'et-contentful-rich-text-mark-bold et-contentful-rich-text-mark-italic',
    );
  });

  it('returns an empty string for no marks', () => {
    expect(marksToClass([])).toBe('');
  });
});

describe('createContentfulIncludeMap', () => {
  it('returns the entry when the content type matches', () => {
    const entry = createEntry('e1', 'teaser');
    const map = createContentfulIncludeMap({ entries: [entry], assets: [] });

    expect(map.getEntry('e1', 'teaser')).toBe(entry);
  });

  it('returns null and warns when the content type does not match', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => void 0);
    const map = createContentfulIncludeMap({ entries: [createEntry('e1', 'teaser')], assets: [] });

    expect(map.getEntry('e1', 'other')).toBeNull();
    expect(warn.mock.calls[0]?.[0]).toContain('Entry sys ID does not match');

    warn.mockRestore();
  });

  it('returns null and warns when the entry does not exist', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => void 0);
    const map = createContentfulIncludeMap({ entries: [], assets: [] });

    expect(map.getEntry('nope', 'teaser')).toBeNull();
    expect(warn.mock.calls[0]?.[0]).toContain('Entry not found!');

    warn.mockRestore();
  });

  it('bypasses the content type check with ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => void 0);
    const entry = createEntry('e1', 'teaser');
    const map = createContentfulIncludeMap({ entries: [entry], assets: [] });

    expect(map.getEntry('e1', ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID)).toBe(entry);
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it('resolves entries by id string and by link item, filtering out misses', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => void 0);
    const a = createEntry('a', 'teaser');
    const b = createEntry('b', 'teaser');
    const map = createContentfulIncludeMap({ entries: [a, b], assets: [] });

    expect(map.getEntries(['a', 'missing', 'b'], 'teaser')).toEqual([a, b]);
    expect(map.getEntries([{ sys: { type: 'Link', linkType: 'Entry', id: 'b' } }], 'teaser')).toEqual([b]);

    warn.mockRestore();
  });

  it('returns the asset by id and null for a missing one', () => {
    const asset = createAsset('a1');
    const map = createContentfulIncludeMap({ entries: [], assets: [asset] });

    expect(map.getAsset('a1')).toBe(asset);
    expect(map.getAsset('nope')).toBeNull();
  });

  it('filters missing assets out of getAssets', () => {
    const asset = createAsset('a1');
    const map = createContentfulIncludeMap({ entries: [], assets: [asset] });

    expect(map.getAssets(['a1', 'nope'])).toEqual([asset]);
  });
});

describe('translateContentfulNodeTypeToHtmlTag', () => {
  it.each([
    [BLOCKS.HEADING_1, 'h1'],
    [BLOCKS.HEADING_2, 'h2'],
    [BLOCKS.HEADING_3, 'h3'],
    [BLOCKS.HEADING_4, 'h4'],
    [BLOCKS.HEADING_5, 'h5'],
    [BLOCKS.HEADING_6, 'h6'],
    [BLOCKS.PARAGRAPH, 'p'],
    [BLOCKS.UL_LIST, 'ul'],
    [BLOCKS.OL_LIST, 'ol'],
    [BLOCKS.LIST_ITEM, 'li'],
    [BLOCKS.HR, 'hr'],
    [BLOCKS.QUOTE, 'blockquote'],
    [BLOCKS.TABLE, 'table'],
    [BLOCKS.TABLE_ROW, 'tr'],
    [BLOCKS.TABLE_CELL, 'td'],
    [BLOCKS.TABLE_HEADER_CELL, 'th'],
    [BLOCKS.EMBEDDED_ASSET, 'div'],
    [BLOCKS.EMBEDDED_ENTRY, 'div'],
    [INLINES.EMBEDDED_ENTRY, 'div'],
    [INLINES.ENTRY_HYPERLINK, 'a'],
    [INLINES.ASSET_HYPERLINK, 'a'],
    ['text', 'span'],
    [BLOCKS.DOCUMENT, 'div'],
  ] as const)('translates %s to <%s>', (nodeType, tag) => {
    expect(translateContentfulNodeTypeToHtmlTag(nodeType)).toBe(tag);
  });

  it('falls back to div for unknown node types', () => {
    expect(translateContentfulNodeTypeToHtmlTag('something-else' as BLOCKS)).toBe('div');
  });
});

describe('isRichTextRootNode', () => {
  it('accepts a document node', () => {
    expect(isRichTextRootNode({ nodeType: 'document', data: {}, content: [] })).toBe(true);
  });

  it.each([[null], [undefined], ['document'], [{}], [{ nodeType: 'paragraph' }]])('rejects %s', (value) => {
    expect(isRichTextRootNode(value)).toBe(false);
  });
});
