import { ContentfulCollection } from '@ethlete/contentful';

type Node = Record<string, unknown>;

const text = (value: string, marks: string[] = []): Node => ({
  nodeType: 'text',
  value,
  marks: marks.map((type) => ({ type })),
  data: {},
});

const block = (nodeType: string, content: Node[] = []): Node => ({ nodeType, content, data: {} });

const withData = (node: Node, data: Node): Node => ({ ...node, data });

const paragraph = (...content: Node[]) => block('paragraph', content);

const link = (type: 'Asset' | 'Entry', id: string) => ({ target: { sys: { type: 'Link', linkType: type, id } } });

const entry = (id: string, contentTypeId: string) => ({
  sys: {
    type: 'Entry',
    id,
    createdAt: '',
    updatedAt: '',
    locale: 'en-US',
    contentType: { sys: { type: 'Link', linkType: 'ContentType', id: contentTypeId } },
  },
  fields: {} as Node,
  metadata: { tags: [] },
});

const collection = (content: Node[], includes: { Asset?: unknown[]; Entry?: unknown[] } = {}) =>
  ({
    sys: { type: 'Array' },
    total: 1,
    skip: 0,
    limit: 1,
    items: [{ ...entry('page-1', 'page'), fields: { html: { nodeType: 'document', data: {}, content } } }],
    includes: { Asset: includes.Asset ?? [], Entry: includes.Entry ?? [] },
  }) as unknown as ContentfulCollection;

export const CALLOUT_ENTRY_ID = 'callout-1';

export const RICH_TEXT_EMBEDS = collection(
  [
    block('heading-1', [text('Embedded entries and assets')]),
    paragraph(
      text('A paragraph mixing '),
      text('bold', ['bold']),
      text(', '),
      text('italic', ['italic']),
      text(' and '),
      text('code', ['code']),
      text(' marks, plus a '),
      withData(block('hyperlink', [text('hyperlink')]), { uri: 'https://example.com' }),
      text('.'),
    ),
    withData(block('embedded-asset-block'), link('Asset', 'asset-1')),
    block('heading-2', [text('Entry blocks')]),
    withData(block('embedded-entry-block'), link('Entry', CALLOUT_ENTRY_ID)),
    withData(block('embedded-entry-block'), link('Entry', 'stat-card-1')),
    paragraph(
      text('An inline entry sits in the text flow: '),
      withData(block('embedded-entry-inline'), link('Entry', 'product-teaser-1')),
      text(' - like that.'),
    ),
  ],
  {
    Asset: [
      {
        sys: { type: 'Asset', id: 'asset-1', createdAt: '', updatedAt: '', locale: 'en-US' },
        fields: {
          title: 'Placeholder',
          description: 'A placeholder image rendered through the built-in asset component.',
          file: {
            url: 'assets/rich-text-editor-image.svg',
            fileName: 'placeholder.svg',
            contentType: 'image/svg+xml',
            details: { size: 1, image: { width: 500, height: 250 } },
          },
        },
        metadata: { tags: [] },
      },
    ],
    Entry: [
      {
        ...entry(CALLOUT_ENTRY_ID, 'callout'),
        fields: { title: 'Heads up', body: 'A callout rendered by a consumer component.' },
      },
      {
        ...entry('stat-card-1', 'statCard'),
        fields: { label: 'Monthly active users', value: '12,480', trend: '+4.2%' },
      },
      { ...entry('product-teaser-1', 'productTeaser'), fields: { name: 'Starter plan' } },
    ],
  },
);
