import { Block, Inline, Mark, Text } from '@contentful/rich-text-types';
import { ContentfulCollection, ContentfulEntry, ContentfulRestAsset, RichTextResponse } from '../types';

const text = (value: string, marks: string[] = []): Text => ({
  nodeType: 'text',
  value,
  marks: marks.map((type) => ({ type })) as Mark[],
  data: {},
});

const block = (nodeType: string, content: (Block | Inline | Text)[] = [], data: Record<string, unknown> = {}) =>
  ({ nodeType, content, data }) as unknown as Block;

const paragraph = (...content: (Block | Inline | Text)[]) => block('paragraph', content);

const heading = (level: 1 | 2 | 3, value: string) => block(`heading-${level}`, [text(value)]);

const hyperlink = (uri: string, value: string) => block('hyperlink', [text(value)], { uri });

const listItem = (...content: (Block | Inline | Text)[]) => block('list-item', [paragraph(...content)]);

const cell = (header: boolean, value: string) =>
  block(header ? 'table-header-cell' : 'table-cell', [paragraph(text(value))]);

const embeddedAsset = (id: string) =>
  block('embedded-asset-block', [], { target: { sys: { type: 'Link', linkType: 'Asset', id } } });

const embeddedEntry = (id: string) =>
  block('embedded-entry-block', [], { target: { sys: { type: 'Link', linkType: 'Entry', id } } });

const inlineEntry = (id: string) =>
  block('embedded-entry-inline', [], { target: { sys: { type: 'Link', linkType: 'Entry', id } } });

const document = (...content: Block[]): RichTextResponse => ({ nodeType: 'document', data: {}, content });

const asset = (id: string, title: string, url: string): ContentfulRestAsset =>
  ({
    sys: { type: 'Asset', id, createdAt: '', updatedAt: '', locale: 'en-US' },
    fields: {
      title,
      description: 'A responsive placeholder image rendered through the built-in asset component.',
      file: {
        url,
        fileName: `${id}.svg`,
        contentType: 'image/svg+xml',
        details: { size: 1, image: { width: 500, height: 250 } },
      },
    },
    metadata: { tags: [] },
  }) satisfies ContentfulRestAsset;

const entry = (id: string, contentTypeId: string, fields: Record<string, unknown>): ContentfulEntry => ({
  sys: {
    type: 'Entry',
    id,
    createdAt: '',
    updatedAt: '',
    locale: 'en-US',
    contentType: { sys: { type: 'Link', linkType: 'ContentType', id: contentTypeId } },
  },
  fields,
  metadata: { tags: [] },
});

const collection = (
  richText: RichTextResponse,
  includes: { Asset?: ContentfulRestAsset[]; Entry?: ContentfulEntry[] } = {},
): ContentfulCollection =>
  ({
    sys: { type: 'Array' },
    total: 1,
    skip: 0,
    limit: 1,
    items: [{ ...entry('page-1', 'page', {}), fields: { html: richText } }],
    includes: { Asset: includes.Asset ?? [], Entry: includes.Entry ?? [] },
  }) as ContentfulCollection;

/** The entry a `Rename the callout` interaction targets, so the story can prove an include change re-renders. */
export const CALLOUT_ENTRY_ID = 'callout-1';

/**
 * Served by Storybook from `apps/storybook/src/assets`. It has to be a real URL, not a `data:` one:
 * the image component appends Contentful's transform query (`?fm=avif&w=…`) to whatever it is given.
 */
const PLACEHOLDER_IMAGE = '/assets/rich-text-editor-image.svg';

/**
 * Every node type that maps to a custom component: an embedded asset, two embedded entry blocks and
 * one inline entry. The content types (`callout`, `statCard`, `productTeaser`) are what
 * `provideContentfulConfig({ customComponents })` keys off.
 */
export const RICH_TEXT_EMBEDS = collection(
  document(
    heading(1, 'Embedded entries and assets'),
    paragraph(
      text('A paragraph mixing '),
      text('bold', ['bold']),
      text(', '),
      text('italic', ['italic']),
      text(' and '),
      text('code', ['code']),
      text(' marks, plus a '),
      hyperlink('https://example.com', 'hyperlink'),
      text('.'),
    ),
    embeddedAsset('asset-1'),
    heading(2, 'Entry blocks'),
    embeddedEntry(CALLOUT_ENTRY_ID),
    embeddedEntry('stat-card-1'),
    paragraph(text('An inline entry sits in the text flow: '), inlineEntry('product-teaser-1'), text(' - like that.')),
  ),
  {
    Asset: [asset('asset-1', 'Placeholder', PLACEHOLDER_IMAGE)],
    Entry: [
      entry(CALLOUT_ENTRY_ID, 'callout', { title: 'Heads up', body: 'A callout rendered by a consumer component.' }),
      entry('stat-card-1', 'statCard', { label: 'Monthly active users', value: '12,480', trend: '+4.2%' }),
      entry('product-teaser-1', 'productTeaser', { name: 'Starter plan' }),
    ],
  },
);

/** Ordered, unordered and nested lists, a blockquote and an `hr`. */
export const RICH_TEXT_LISTS = collection(
  document(
    heading(2, 'Lists and quotes'),
    block('unordered-list', [
      listItem(text('A plain list item')),
      listItem(text('One with a '), hyperlink('https://example.com', 'link')),
      listItem(text('One with '), text('emphasis', ['italic'])),
    ]),
    block('ordered-list', [
      listItem(text('First')),
      listItem(text('Second')),
      block('list-item', [
        paragraph(text('Third, with a nested list')),
        block('unordered-list', [listItem(text('Nested one')), listItem(text('Nested two'))]),
      ]),
    ]),
    block('blockquote', [paragraph(text('A blockquote renders as its own block.'))]),
    block('hr'),
    paragraph(text('Content after the rule.')),
  ),
);

/** A table with a header row - the node types that map to `table`, `tr`, `th` and `td`. */
export const RICH_TEXT_TABLES = collection(
  document(
    heading(2, 'Tables'),
    block('table', [
      block('table-row', [cell(true, 'Plan'), cell(true, 'Seats'), cell(true, 'Price')]),
      block('table-row', [cell(false, 'Starter'), cell(false, '3'), cell(false, '$0')]),
      block('table-row', [cell(false, 'Team'), cell(false, '25'), cell(false, '$49')]),
      block('table-row', [cell(false, 'Enterprise'), cell(false, 'Unlimited'), cell(false, 'Custom')]),
    ]),
    paragraph(text('Cells hold full rich text, so each one is a paragraph node.')),
  ),
);
