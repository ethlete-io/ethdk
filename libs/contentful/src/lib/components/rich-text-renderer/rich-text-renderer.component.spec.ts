import { Component, OnDestroy, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Block, Inline, Mark, Text } from '@contentful/rich-text-types';
import { RuntimeError } from '@ethlete/core';
import {
  ContentfulCollection,
  ContentfulEntry,
  ContentfulEntrySys,
  ContentfulMetadata,
  ContentfulRestAsset,
  RichTextResponse,
} from '../../types';
import { provideContentfulConfig } from '../../utils/contentful.util';
import { ContentfulIncludeMap, ContentfulRichTextRendererComponent } from './rich-text-renderer.component';

/* eslint-disable @typescript-eslint/no-explicit-any */

const text = (value: string, marks: string[] = []): Text => ({
  nodeType: 'text',
  value,
  marks: marks.map((type) => ({ type })) as Mark[],
  data: {},
});

const block = (nodeType: string, content: (Block | Inline | Text)[] = [], data: Record<string, unknown> = {}) =>
  ({ nodeType, content, data }) as unknown as Block;

const paragraph = (value: string, marks: string[] = []) => block('paragraph', [text(value, marks)]);

const doc = (...content: Block[]): RichTextResponse => ({ nodeType: 'document', data: {}, content });

const embeddedAsset = (assetId: string) =>
  block('embedded-asset-block', [], { target: { sys: { type: 'Link', linkType: 'Asset', id: assetId } } });

const embeddedEntry = (entryId: string) =>
  block('embedded-entry-block', [], { target: { sys: { type: 'Link', linkType: 'Entry', id: entryId } } });

const inlineEmbeddedEntry = (entryId: string) =>
  block('embedded-entry-inline', [], { target: { sys: { type: 'Link', linkType: 'Entry', id: entryId } } });

const hyperlink = (uri: string, value: string, marks: string[] = []) =>
  block('hyperlink', [text(value, marks)], { uri });

const targetHyperlink = (nodeType: 'asset-hyperlink' | 'entry-hyperlink', targetId: string, value: string) =>
  block(nodeType, [text(value)], { target: { sys: { id: targetId } } });

const createAsset = (id: string, contentType: string | null, url: string | null = `//cdn/${id}`): ContentfulRestAsset =>
  ({
    sys: { type: 'Asset', id, createdAt: '', updatedAt: '', locale: 'en-US' },
    fields: {
      title: id,
      description: '',
      file: { url, details: { size: 1, image: { width: 10, height: 10 } }, fileName: id, contentType },
    },
    metadata: { tags: [] },
  }) satisfies ContentfulRestAsset;

const createEntry = (id: string, contentTypeId: string, fields: Record<string, unknown> = {}): ContentfulEntry => ({
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

const createCollection = (
  richText: unknown,
  includes: { Asset?: ContentfulRestAsset[]; Entry?: ContentfulEntry[] } = {},
): ContentfulCollection =>
  ({
    includes: { Asset: includes.Asset ?? [], Entry: includes.Entry ?? [] },
    items: [{ ...createEntry('item-1', 'page'), fields: { html: richText } }],
    limit: 1,
    skip: 0,
    total: 1,
    sys: { type: 'Array' },
  }) as ContentfulCollection;

@Component({ selector: 'et-stub-image', template: `<span>image</span>` })
class StubImageComponent {
  static instances: StubImageComponent[] = [];
  asset = input<ContentfulRestAsset | null>(null);

  constructor() {
    StubImageComponent.instances.push(this);
  }
}

@Component({ selector: 'et-stub-video', template: `<span>video</span>` })
class StubVideoComponent {
  asset = input<ContentfulRestAsset | null>(null);
}

@Component({ selector: 'et-stub-audio', template: `<span>audio</span>` })
class StubAudioComponent {
  asset = input<ContentfulRestAsset | null>(null);
}

@Component({ selector: 'et-stub-file', template: `<span>file</span>` })
class StubFileComponent {
  asset = input<ContentfulRestAsset | null>(null);
}

@Component({ selector: 'et-stub-link', template: `<span [class]="textClass()">{{ text() }}</span>` })
class StubLinkComponent {
  static instances: StubLinkComponent[] = [];

  href = input('');
  text = input('');
  textClass = input('');

  constructor() {
    StubLinkComponent.instances.push(this);
  }
}

@Component({ selector: 'et-stub-teaser', template: `<span class="teaser">{{ fields()?.title }}</span>` })
class StubTeaserComponent implements OnDestroy {
  static instances: StubTeaserComponent[] = [];
  static destroyed = 0;

  fields = input<Record<string, any> | null>(null);
  sys = input<ContentfulEntrySys | null>(null);
  metadata = input<ContentfulMetadata | null>(null);
  includes = input<ContentfulIncludeMap | null>(null);

  constructor() {
    StubTeaserComponent.instances.push(this);
  }

  ngOnDestroy() {
    StubTeaserComponent.destroyed++;
  }
}

@Component({ selector: 'et-stub-partial', template: `<span class="partial">{{ fields()?.title }}</span>` })
class StubPartialComponent {
  static instances: StubPartialComponent[] = [];

  fields = input<Record<string, any> | null>(null);

  constructor() {
    StubPartialComponent.instances.push(this);
  }
}

@Component({
  selector: 'et-test-host',
  template: `<et-contentful-rich-text-renderer [content]="content()" [richTextPath]="richTextPath()" />`,
  imports: [ContentfulRichTextRendererComponent],
})
class TestHostComponent {
  content = signal<ContentfulCollection | null>(null);
  richTextPath = signal('items[0].fields.html');
}

type SetupOptions = {
  richText?: unknown;
  includes?: { Asset?: ContentfulRestAsset[]; Entry?: ContentfulEntry[] };
  content?: ContentfulCollection | null;
  richTextPath?: string;
  customComponents?: Record<string, any>;
  useStubAssetComponents?: boolean;
  withoutConfig?: boolean;
};

const setup = (options: SetupOptions = {}) => {
  const components = options.useStubAssetComponents
    ? {
        image: StubImageComponent as any,
        video: StubVideoComponent as any,
        audio: StubAudioComponent as any,
        file: StubFileComponent as any,
        link: StubLinkComponent as any,
      }
    : undefined;

  TestBed.configureTestingModule({
    imports: [TestHostComponent],
    providers: [
      provideRouter([]),
      ...(options.withoutConfig
        ? []
        : [
            provideContentfulConfig({
              ...(components ? { components } : {}),
              customComponents: options.customComponents ?? {},
            }),
          ]),
    ],
  });

  const fixture = TestBed.createComponent(TestHostComponent);
  const host = fixture.componentInstance;

  if (options.richTextPath) {
    host.richTextPath.set(options.richTextPath);
  }

  host.content.set(
    options.content !== undefined ? options.content : createCollection(options.richText ?? doc(), options.includes),
  );

  fixture.detectChanges();

  return { fixture, host };
};

const renderRoot = (fixture: ComponentFixture<TestHostComponent>) =>
  fixture.nativeElement.querySelector('et-contentful-rich-text-renderer') as HTMLElement;

const setContent = (
  fixture: ComponentFixture<TestHostComponent>,
  richText: unknown,
  includes?: { Asset?: ContentfulRestAsset[]; Entry?: ContentfulEntry[] },
) => {
  fixture.componentInstance.content.set(createCollection(richText, includes));
  fixture.detectChanges();
};

const readRenderCommands = (options: SetupOptions = {}) => {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideContentfulConfig({ customComponents: options.customComponents ?? {} })],
  });

  const fixture = TestBed.createComponent(ContentfulRichTextRendererComponent);

  fixture.componentRef.setInput('content', createCollection(options.richText ?? doc(), options.includes));
  fixture.componentRef.setInput('richTextPath', options.richTextPath ?? 'items[0].fields.html');

  try {
    return (fixture.componentInstance as any).renderCommands();
  } finally {
    fixture.destroy();
  }
};

const DEFAULT_SPAN_CLASS = 'et-contentful-rich-text-default-element et-contentful-rich-text-default-span';

describe('ContentfulRichTextRendererComponent', () => {
  beforeEach(() => {
    StubImageComponent.instances = [];
    StubTeaserComponent.instances = [];
    StubTeaserComponent.destroyed = 0;
    StubPartialComponent.instances = [];
    StubLinkComponent.instances = [];
  });

  describe('static rendering', () => {
    it('renders nothing for an empty document', () => {
      const { fixture } = setup({ richText: doc() });

      expect(renderRoot(fixture).innerHTML).toBe('');
    });

    it('renders nothing when the content is null', () => {
      const { fixture } = setup({ content: null });

      expect(renderRoot(fixture).innerHTML).toBe('');
    });

    it('renders a response that omits includes', () => {
      const content = createCollection(doc(paragraph('Body')));
      delete content.includes;
      const { fixture } = setup({ content });

      expect(renderRoot(fixture).textContent).toBe('Body');
    });

    it('renders headings and paragraphs with default element classes', () => {
      const { fixture } = setup({
        richText: doc(block('heading-1', [text('Title')]), paragraph('Body')),
      });
      const root = renderRoot(fixture);

      const h1 = root.querySelector('h1');
      expect(h1?.getAttribute('class')).toBe(
        'et-contentful-rich-text-default-element et-contentful-rich-text-default-h1',
      );
      expect(h1?.textContent).toBe('Title');

      const span = h1?.querySelector('span');
      expect(span?.getAttribute('class')).toBe(DEFAULT_SPAN_CLASS);

      const p = root.querySelector('p');
      expect(p?.getAttribute('class')).toBe(
        'et-contentful-rich-text-default-element et-contentful-rich-text-default-p',
      );
      expect(p?.textContent).toBe('Body');
      expect(Array.from(root.children).map((c) => c.tagName)).toEqual(['H1', 'P']);
    });

    it('wraps marked text in nested semantic elements', () => {
      const { fixture } = setup({
        richText: doc(block('paragraph', [text('plain'), text('strong', ['bold', 'italic'])])),
      });

      const spans = renderRoot(fixture).querySelectorAll('p > span');

      expect(spans[0]?.getAttribute('class')).toBe(DEFAULT_SPAN_CLASS);
      expect(spans[1]?.getAttribute('class')).toBe(DEFAULT_SPAN_CLASS);
      expect(spans[1]?.innerHTML).toBe('<strong><em>strong</em></strong>');
      expect(spans[1]?.textContent).toBe('strong');
    });

    it('renders nested lists', () => {
      const { fixture } = setup({
        richText: doc(
          block('unordered-list', [
            block('list-item', [paragraph('one')]),
            block('list-item', [paragraph('two'), block('ordered-list', [block('list-item', [paragraph('two.one')])])]),
          ]),
        ),
      });

      const root = renderRoot(fixture);
      const items = root.querySelectorAll('ul > li');

      expect(items).toHaveLength(2);
      expect(items[0]?.querySelector('p')?.textContent).toBe('one');
      expect(root.querySelector('ul > li > ol > li > p')?.textContent).toBe('two.one');
    });

    it('renders a blockquote', () => {
      const { fixture } = setup({ richText: doc(block('blockquote', [paragraph('quoted')])) });

      expect(renderRoot(fixture).querySelector('blockquote > p')?.textContent).toBe('quoted');
    });

    it('renders a table with header and body cells', () => {
      const { fixture } = setup({
        richText: doc(
          block('table', [
            block('table-row', [block('table-header-cell', [paragraph('H')])]),
            block('table-row', [block('table-cell', [paragraph('C')])]),
          ]),
        ),
      });

      const root = renderRoot(fixture);

      expect(root.querySelector('table > tr > th > p')?.textContent).toBe('H');
      expect(root.querySelector('table > tr > td > p')?.textContent).toBe('C');
    });

    it('renders an hr', () => {
      const { fixture } = setup({ richText: doc(block('hr'), paragraph('after')) });

      expect(Array.from(renderRoot(fixture).children).map((c) => c.tagName)).toEqual(['HR', 'P']);
    });

    it('prunes empty elements but keeps empty table cells and hr', () => {
      const { fixture } = setup({
        richText: doc(
          block('paragraph'),
          block('heading-2'),
          block('hr'),
          block('table', [block('table-row', [block('table-cell'), block('table-header-cell')])]),
        ),
      });

      const root = renderRoot(fixture);

      expect(root.querySelector('p')).toBeNull();
      expect(root.querySelector('h2')).toBeNull();
      expect(root.querySelector('hr')).not.toBeNull();
      expect(root.querySelectorAll('td')).toHaveLength(1);
      expect(root.querySelectorAll('th')).toHaveLength(1);
    });

    it('skips text nodes with an empty value', () => {
      const { fixture } = setup({ richText: doc(block('paragraph', [text(''), text('kept')])) });

      const spans = renderRoot(fixture).querySelectorAll('p > span');

      expect(spans).toHaveLength(1);
      expect(spans[0]?.textContent).toBe('kept');
    });

    it('preserves a whitespace-only text node between marked runs', () => {
      const { fixture } = setup({
        richText: doc(block('paragraph', [text('bold', ['bold']), text(' '), text('italic', ['italic'])])),
      });

      expect(renderRoot(fixture).querySelector('p')?.textContent).toBe('bold italic');
    });
  });

  describe('line breaks', () => {
    it('splits text on \\n with <br> inside the span', () => {
      const { fixture } = setup({ richText: doc(block('paragraph', [text('one\ntwo')])) });

      const span = renderRoot(fixture).querySelector('p > span');

      expect(span?.innerHTML).toBe('one<br>two');
    });

    it('keeps a leading <br> inside the tracked text span', () => {
      const { fixture } = setup({ richText: doc(block('paragraph', [text('\nvalue')])) });

      const p = renderRoot(fixture).querySelector('p');

      expect(p?.innerHTML).toBe(`<span class="${DEFAULT_SPAN_CLASS}"><br>value</span>`);
    });

    it('preserves blank lines between text segments', () => {
      const { fixture } = setup({ richText: doc(block('paragraph', [text('one\n\ntwo')])) });

      expect(renderRoot(fixture).querySelector('p > span')?.innerHTML).toBe('one<br><br>two');
    });
  });

  describe('embedded assets', () => {
    it.each([
      ['image/png', 'ET-STUB-IMAGE'],
      ['video/mp4', 'ET-STUB-VIDEO'],
      ['audio/mpeg', 'ET-STUB-AUDIO'],
      ['application/pdf', 'ET-STUB-FILE'],
    ])('picks the component for %s', (contentType, tagName) => {
      const asset = createAsset('a1', contentType);
      const { fixture } = setup({
        useStubAssetComponents: true,
        richText: doc(embeddedAsset('a1')),
        includes: { Asset: [asset] },
      });

      expect(renderRoot(fixture).children[0]?.tagName).toBe(tagName);
    });

    it('sets the asset input on the created component', () => {
      const asset = createAsset('a1', 'image/png');
      setup({ useStubAssetComponents: true, richText: doc(embeddedAsset('a1')), includes: { Asset: [asset] } });

      expect(StubImageComponent.instances).toHaveLength(1);
      expect(StubImageComponent.instances[0]?.asset()).toBe(asset);
    });

    it('skips an embedded asset when no component is registered for it', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => void 0);
      const asset = createAsset('a1', 'image/png');

      const { fixture } = setup({
        withoutConfig: true,
        richText: doc(embeddedAsset('a1')),
        includes: { Asset: [asset] },
      });

      expect(renderRoot(fixture).querySelector('et-contentful-image')).toBeNull();
      expect(warn).toHaveBeenCalled();

      warn.mockRestore();
    });

    it('skips an asset without file data', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => void 0);
      const { fixture } = setup({
        useStubAssetComponents: true,
        richText: doc(embeddedAsset('a1')),
        includes: { Asset: [createAsset('a1', null, null)] },
      });

      expect(renderRoot(fixture).innerHTML).toBe('');
      expect(warn).toHaveBeenCalled();

      warn.mockRestore();
    });
  });

  describe('embedded entries', () => {
    it('renders the custom component keyed by content type id with all declared inputs', () => {
      const entry = createEntry('e1', 'teaser', { title: 'Teaser title' });
      const { fixture } = setup({
        customComponents: { teaser: StubTeaserComponent },
        richText: doc(embeddedEntry('e1')),
        includes: { Entry: [entry] },
      });

      const instance = StubTeaserComponent.instances[0];

      expect(renderRoot(fixture).querySelector('.teaser')?.textContent).toBe('Teaser title');
      expect(instance?.fields()).toBe(entry.fields);
      expect(instance?.sys()).toBe(entry.sys);
      expect(instance?.metadata()).toBe(entry.metadata);
      expect(typeof instance?.includes().getEntry).toBe('function');
    });

    it('only sets inputs that the component declares', () => {
      const entry = createEntry('e1', 'partial', { title: 'Partial title' });
      const { fixture } = setup({
        customComponents: { partial: StubPartialComponent },
        richText: doc(embeddedEntry('e1')),
        includes: { Entry: [entry] },
      });

      expect(renderRoot(fixture).querySelector('.partial')?.textContent).toBe('Partial title');
      expect(StubPartialComponent.instances[0]?.fields()).toBe(entry.fields);
      expect((StubPartialComponent.instances[0] as unknown as Record<string, unknown>)['sys']).toBeUndefined();
    });
  });

  describe('hyperlinks', () => {
    it('renders the link component with href, text and textClass', () => {
      const { fixture } = setup({
        useStubAssetComponents: true,
        richText: doc(block('paragraph', [hyperlink('https://example.com', 'Example', ['bold'])])),
      });

      const link = renderRoot(fixture).querySelector('et-stub-link');

      expect(link).not.toBeNull();
      expect(link?.textContent).toBe('Example');
      expect(StubLinkComponent.instances[0]?.href()).toBe('https://example.com');
      expect(StubLinkComponent.instances[0]?.textClass()).toBe('et-contentful-rich-text-mark-bold');
    });

    it('renders a plain anchor when no config provides a link component', () => {
      const { fixture } = setup({
        withoutConfig: true,
        richText: doc(block('paragraph', [hyperlink('https://example.com', 'Example', ['bold'])])),
      });

      const anchor = renderRoot(fixture).querySelector('p > a');

      expect(renderRoot(fixture).querySelector('et-contentful-link')).toBeNull();
      expect(anchor?.getAttribute('href')).toBe('https://example.com');
      expect(anchor?.getAttribute('class')).toBe(
        'et-contentful-rich-text-default-element et-contentful-rich-text-default-a',
      );
      expect(anchor?.textContent).toBe('Example');
      expect(anchor?.querySelector('strong')).not.toBeNull();
    });

    it('does not assign an unsafe href to a fallback anchor', () => {
      const { fixture } = setup({
        withoutConfig: true,
        richText: doc(block('paragraph', [hyperlink('javascript:alert(1)', 'Unsafe')])),
      });

      expect(renderRoot(fixture).querySelector('a')).toBeNull();
      expect(renderRoot(fixture).querySelector('p')?.textContent).toBe('Unsafe');
    });

    it('resolves an asset hyperlink to the included asset url', () => {
      const asset = createAsset('a1', 'application/pdf', '//cdn/file.pdf');
      const { fixture } = setup({
        richText: doc(block('paragraph', [targetHyperlink('asset-hyperlink', 'a1', 'File')])),
        includes: { Asset: [asset] },
      });

      expect(renderRoot(fixture).querySelector('a')?.getAttribute('href')).toBe('//cdn/file.pdf');
    });

    it('renders an entry hyperlink as text when no route can be inferred', () => {
      const entry = createEntry('e1', 'page');
      const { fixture } = setup({
        richText: doc(block('paragraph', [targetHyperlink('entry-hyperlink', 'e1', 'Page')])),
        includes: { Entry: [entry] },
      });

      expect(renderRoot(fixture).querySelector('a')).toBeNull();
      expect(renderRoot(fixture).querySelector('p')?.textContent).toBe('Page');
    });

    it('renders the default link component', () => {
      const { fixture } = setup({
        richText: doc(block('paragraph', [hyperlink('https://example.com', 'Example')])),
      });

      const anchor = renderRoot(fixture).querySelector('et-contentful-link a');

      expect(anchor?.getAttribute('href')).toBe('https://example.com');
      expect(anchor?.textContent).toBe('Example');
    });

    it('passes the collected marks as the textClass', () => {
      const { fixture } = setup({
        richText: doc(block('paragraph', [hyperlink('/internal', 'Example', ['bold', 'italic'])])),
      });

      const anchor = renderRoot(fixture).querySelector('et-contentful-link a');

      expect(anchor?.getAttribute('class')).toContain(
        'et-contentful-rich-text-mark-bold et-contentful-rich-text-mark-italic',
      );
    });
  });

  describe('diffing', () => {
    it('preserves the only component instance and updates its inputs', () => {
      const before = createEntry('e1', 'teaser', { title: 'Before' });
      const after = createEntry('e1', 'teaser', { title: 'After' });

      const { fixture } = setup({
        customComponents: { teaser: StubTeaserComponent },
        richText: doc(embeddedEntry('e1')),
        includes: { Entry: [before] },
      });

      const instance = StubTeaserComponent.instances[0];

      setContent(fixture, doc(embeddedEntry('e1')), { Entry: [after] });

      expect(StubTeaserComponent.instances).toHaveLength(1);
      expect(StubTeaserComponent.instances[0]).toBe(instance);
      expect(StubTeaserComponent.destroyed).toBe(0);

      expect(instance?.fields()).toBe(after.fields);
      expect(renderRoot(fixture).querySelector('.teaser')?.textContent).toBe('After');
    });

    it('updates every preserved component', () => {
      const a1 = createEntry('a', 'teaser', { title: 'A' });
      const b1 = createEntry('b', 'teaser', { title: 'B' });
      const a2 = createEntry('a', 'teaser', { title: 'A2' });
      const b2 = createEntry('b', 'teaser', { title: 'B2' });

      const { fixture } = setup({
        customComponents: { teaser: StubTeaserComponent },
        richText: doc(embeddedEntry('a'), embeddedEntry('b')),
        includes: { Entry: [a1, b1] },
      });

      const [first, second] = StubTeaserComponent.instances;

      setContent(fixture, doc(embeddedEntry('a'), embeddedEntry('b')), { Entry: [a2, b2] });

      expect(StubTeaserComponent.instances).toEqual([first, second]);
      expect(first?.fields()).toBe(a2.fields);
      expect(second?.fields()).toBe(b2.fields);
    });

    it('destroys the old component and creates a new one when a different entry takes the slot', () => {
      const a = createEntry('a', 'teaser', { title: 'A' });
      const c = createEntry('c', 'teaser', { title: 'C' });

      const { fixture } = setup({
        customComponents: { teaser: StubTeaserComponent },
        richText: doc(embeddedEntry('a')),
        includes: { Entry: [a] },
      });

      setContent(fixture, doc(embeddedEntry('c')), { Entry: [c] });

      expect(StubTeaserComponent.destroyed).toBe(1);
      expect(StubTeaserComponent.instances).toHaveLength(2);
      expect(renderRoot(fixture).querySelector('.teaser')?.textContent).toBe('C');
    });

    it('destroys the component and removes its DOM when the entry is gone', () => {
      const entry = createEntry('e1', 'teaser', { title: 'Teaser' });

      const { fixture } = setup({
        customComponents: { teaser: StubTeaserComponent },
        richText: doc(embeddedEntry('e1')),
        includes: { Entry: [entry] },
      });

      expect(renderRoot(fixture).querySelector('.teaser')).not.toBeNull();

      setContent(fixture, doc(paragraph('replacement')));

      expect(StubTeaserComponent.destroyed).toBe(1);
      expect(renderRoot(fixture).querySelector('.teaser')).toBeNull();
      expect(renderRoot(fixture).querySelector('p')?.textContent).toBe('replacement');
    });

    it('keeps unchanged plain elements and component instances across a content change', () => {
      const entry = createEntry('e1', 'teaser', { title: 'Teaser' });

      const { fixture } = setup({
        customComponents: { teaser: StubTeaserComponent },
        richText: doc(paragraph('same'), embeddedEntry('e1')),
        includes: { Entry: [entry] },
      });

      const instanceBefore = StubTeaserComponent.instances[0];
      const pBefore = renderRoot(fixture).querySelector('p');
      const spanBefore = renderRoot(fixture).querySelector('p > span');

      setContent(fixture, doc(paragraph('same'), embeddedEntry('e1')), { Entry: [entry] });

      expect(renderRoot(fixture).querySelector('p')).toBe(pBefore);
      expect(renderRoot(fixture).querySelector('p > span')).toBe(spanBefore);
      expect(renderRoot(fixture).querySelector('p')?.textContent).toBe('same');
      expect(StubTeaserComponent.instances[0]).toBe(instanceBefore);
      expect(StubTeaserComponent.instances).toHaveLength(1);
    });

    it('recreates only the changed text span inside a preserved element', () => {
      const { fixture } = setup({
        richText: doc(block('paragraph', [text('stable'), text(' changing')])),
      });

      const pBefore = renderRoot(fixture).querySelector('p');
      const [stableBefore, changingBefore] = Array.from(renderRoot(fixture).querySelectorAll('p > span'));

      setContent(fixture, doc(block('paragraph', [text('stable'), text(' changed')])));

      const spans = Array.from(renderRoot(fixture).querySelectorAll('p > span'));

      expect(renderRoot(fixture).querySelector('p')).toBe(pBefore);
      expect(spans[0]).toBe(stableBefore);
      expect(spans[1]).not.toBe(changingBefore);
      expect(spans.map((s) => s.textContent)).toEqual(['stable', ' changed']);
    });

    it('reattaches a preserved component when its parent element is rebuilt', () => {
      const entry = createEntry('e1', 'teaser', { title: 'Teaser' });

      const { fixture } = setup({
        customComponents: { teaser: StubTeaserComponent },
        richText: doc(block('paragraph', [text('before '), inlineEmbeddedEntry('e1')])),
        includes: { Entry: [entry] },
      });

      const instance = StubTeaserComponent.instances[0];

      expect(renderRoot(fixture).querySelector('p .teaser')).not.toBeNull();

      setContent(fixture, doc(block('paragraph', [text('rewritten '), inlineEmbeddedEntry('e1')])), {
        Entry: [entry],
      });

      expect(StubTeaserComponent.instances).toEqual([instance]);
      expect(StubTeaserComponent.destroyed).toBe(0);
      expect(renderRoot(fixture).querySelector('p .teaser')).not.toBeNull();
      expect(renderRoot(fixture).querySelector('p')?.textContent).toBe('rewritten Teaser');
    });

    it('keeps recreated nested text in sibling order', () => {
      const { fixture } = setup({ richText: doc(block('paragraph', [text('A'), text('B'), text('C')])) });

      setContent(fixture, doc(block('paragraph', [text('A'), text('B2'), text('C')])));
      expect(renderRoot(fixture).querySelector('p')?.textContent).toBe('AB2C');

      setContent(fixture, doc(block('paragraph', [text('A2'), text('B2'), text('C')])));
      expect(renderRoot(fixture).querySelector('p')?.textContent).toBe('A2B2C');
    });

    it('does not duplicate a leading line break across rerenders', () => {
      const { fixture } = setup({ richText: doc(block('paragraph', [text('\nA')])) });

      setContent(fixture, doc(block('paragraph', [text('\nB')])));

      expect(renderRoot(fixture).querySelector('p')?.innerHTML).toBe(
        `<span class="${DEFAULT_SPAN_CLASS}"><br>B</span>`,
      );
    });

    it('moves the component instances with their entries when two entries swap places', () => {
      const a = createEntry('a', 'teaser', { title: 'A' });
      const b = createEntry('b', 'teaser', { title: 'B' });

      const { fixture } = setup({
        customComponents: { teaser: StubTeaserComponent },
        richText: doc(embeddedEntry('a'), embeddedEntry('b')),
        includes: { Entry: [a, b] },
      });

      const [first, second] = StubTeaserComponent.instances;

      expect(Array.from(renderRoot(fixture).querySelectorAll('.teaser')).map((e) => e.textContent)).toEqual(['A', 'B']);

      setContent(fixture, doc(embeddedEntry('b'), embeddedEntry('a')), { Entry: [a, b] });

      expect(StubTeaserComponent.instances).toEqual([first, second]);
      expect(StubTeaserComponent.destroyed).toBe(0);
      expect(first?.fields()).toBe(a.fields);
      expect(second?.fields()).toBe(b.fields);
      expect(Array.from(renderRoot(fixture).querySelectorAll('.teaser')).map((e) => e.textContent)).toEqual(['B', 'A']);
    });

    it('reorders the DOM and preserves both instances when entries of different types swap places', () => {
      const a = createEntry('a', 'teaser', { title: 'A' });
      const b = createEntry('b', 'partial', { title: 'B' });

      const { fixture } = setup({
        customComponents: { teaser: StubTeaserComponent, partial: StubPartialComponent },
        richText: doc(embeddedEntry('a'), embeddedEntry('b')),
        includes: { Entry: [a, b] },
      });

      const teaser = StubTeaserComponent.instances[0];
      const partial = StubPartialComponent.instances[0];

      expect(Array.from(renderRoot(fixture).querySelectorAll('.teaser, .partial')).map((e) => e.textContent)).toEqual([
        'A',
        'B',
      ]);

      setContent(fixture, doc(embeddedEntry('b'), embeddedEntry('a')), { Entry: [a, b] });

      expect(StubTeaserComponent.instances).toEqual([teaser]);
      expect(StubPartialComponent.instances).toEqual([partial]);
      expect(StubTeaserComponent.destroyed).toBe(0);
      expect(Array.from(renderRoot(fixture).querySelectorAll('.teaser, .partial')).map((e) => e.textContent)).toEqual([
        'B',
        'A',
      ]);
    });

    it('creates a new component when an additional entry of the same type appears', () => {
      const a = createEntry('a', 'teaser', { title: 'A' });
      const b = createEntry('b', 'teaser', { title: 'B' });

      const { fixture } = setup({
        customComponents: { teaser: StubTeaserComponent },
        richText: doc(embeddedEntry('a')),
        includes: { Entry: [a] },
      });

      setContent(fixture, doc(embeddedEntry('a'), embeddedEntry('b')), { Entry: [a, b] });

      expect(StubTeaserComponent.instances).toHaveLength(2);
      expect(Array.from(renderRoot(fixture).querySelectorAll('.teaser')).map((e) => e.textContent)).toEqual(['A', 'B']);
    });
  });

  describe('errors', () => {
    it('renders nothing for a path that resolves to an absent field', () => {
      expect(readRenderCommands({ richText: doc(paragraph('a')), richTextPath: 'items[0].fields.missing' })).toEqual(
        [],
      );
    });

    it('throws rich_text_wrong_type for a non document node', () => {
      expect(() => readRenderCommands({ richText: { nodeType: 'paragraph', data: {}, content: [] } })).toThrow(
        /does not satisfy the RichTextResponse interface/,
      );
    });

    it('throws a RuntimeError when no custom component is registered for the entry content type', () => {
      let error: unknown;

      try {
        readRenderCommands({
          richText: doc(embeddedEntry('e1')),
          includes: { Entry: [createEntry('e1', 'unknown-type')] },
        });
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(RuntimeError);
      expect((error as RuntimeError).message).toContain('No custom component found for entry type');
    });

    it('throws when the referenced asset is not in the includes', () => {
      expect(() => readRenderCommands({ richText: doc(embeddedAsset('missing')) })).toThrow(/The asset was not found/);
    });

    it('throws when the referenced entry is not in the includes', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => void 0);

      expect(() =>
        readRenderCommands({
          customComponents: { teaser: StubTeaserComponent },
          richText: doc(embeddedEntry('nope')),
        }),
      ).toThrow(/The entry was not found/);

      warn.mockRestore();
    });
  });
});
