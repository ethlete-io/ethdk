import { ApplicationRef, Component, destroyPlatform, input, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication, provideClientHydration, ɵBrowserDomAdapter } from '@angular/platform-browser';
import { provideServerRendering, renderApplication, ɵDominoAdapter } from '@angular/platform-server';
import { provideRouter } from '@angular/router';
import { ContentfulCollection } from '../../types';
import { CONTENTFUL_DEFAULT_COMPONENTS } from '../../utils/contentful-default-components';
import { provideContentfulConfig } from '../../utils/contentful.util';
import { ContentfulRichTextRendererComponent } from './rich-text-renderer.component';

@Component({ selector: 'et-hydration-teaser', template: `<span class="teaser">{{ fields()?.['title'] }}</span>` })
class TeaserComponent {
  fields = input<Record<string, unknown> | null>(null);
}

const content = {
  includes: {
    Asset: [],
    Entry: [
      {
        sys: {
          type: 'Entry',
          id: 'e1',
          createdAt: '',
          updatedAt: '',
          locale: 'en-US',
          contentType: { sys: { type: 'Link', linkType: 'ContentType', id: 'teaser' } },
        },
        fields: { title: 'Teaser title' },
        metadata: { tags: [] },
      },
    ],
  },
  items: [
    {
      sys: { type: 'Entry', id: 'page', createdAt: '', updatedAt: '', locale: 'en-US' },
      fields: {
        html: {
          nodeType: 'document',
          data: {},
          content: [
            {
              nodeType: 'paragraph',
              data: {},
              content: [{ nodeType: 'text', value: 'Before', marks: [], data: {} }],
            },
            {
              nodeType: 'embedded-entry-block',
              data: { target: { sys: { type: 'Link', linkType: 'Entry', id: 'e1' } } },
              content: [],
            },
            {
              nodeType: 'paragraph',
              data: {},
              content: [{ nodeType: 'text', value: 'After', marks: [], data: {} }],
            },
          ],
        },
      },
      metadata: { tags: [] },
    },
  ],
  limit: 1,
  skip: 0,
  total: 1,
  sys: { type: 'Array' },
} as unknown as ContentfulCollection;

@Component({
  selector: 'et-hydration-page',
  template: `
    <h1>Home</h1>
    @if (content) {
      <et-contentful-rich-text-renderer [content]="content" richTextPath="items[0].fields.html" />
    }
    <footer>Footer</footer>
  `,
  imports: [ContentfulRichTextRendererComponent],
})
class PageComponent {
  content = content;
}

const providers = () => [
  provideZonelessChangeDetection(),
  provideRouter([]),
  provideContentfulConfig({ ...CONTENTFUL_DEFAULT_COMPONENTS, customComponents: { teaser: TeaserComponent } }),
];

const renderOnServer = async () => {
  ɵDominoAdapter.makeCurrent();

  try {
    return await renderApplication(
      (context) =>
        bootstrapApplication(
          PageComponent,
          { providers: [...providers(), provideClientHydration(), provideServerRendering()] },
          context,
        ),
      { document: '<html><head></head><body><et-hydration-page></et-hydration-page></body></html>', url: '/' },
    );
  } finally {
    destroyPlatform();
    ɵBrowserDomAdapter.makeCurrent();
  }
};

const textOf = (selector: string) =>
  [...document.querySelectorAll(`et-contentful-rich-text-renderer ${selector}`)].map((el) => el.textContent?.trim());

describe('ContentfulRichTextRendererComponent hydration', () => {
  afterEach(() => {
    destroyPlatform();
    document.body.innerHTML = '';
  });

  it('hydrates a server render whose rich text embeds an Angular component', async () => {
    const serverHtml = await renderOnServer();
    const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(serverHtml)?.[1] ?? '';

    expect(body).toContain('Teaser title');
    expect(body).toContain('ngh=');

    document.body.innerHTML = body;

    const errors: unknown[] = [];
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args));

    try {
      const appRef = await bootstrapApplication(PageComponent, {
        providers: [...providers(), provideClientHydration()],
      });

      await appRef.whenStable();

      expect(errors).toEqual([]);
      expect(appRef).toBeInstanceOf(ApplicationRef);
      expect(textOf('.teaser')).toEqual(['Teaser title']);
      expect(document.querySelector('et-contentful-rich-text-renderer')?.textContent?.replace(/\s+/g, '')).toBe(
        'BeforeTeasertitleAfter',
      );
      expect(document.querySelector('footer')?.textContent).toBe('Footer');
    } finally {
      consoleError.mockRestore();
    }
  }, 30_000);
});
