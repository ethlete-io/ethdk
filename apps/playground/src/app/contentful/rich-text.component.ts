import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, signal } from '@angular/core';
import { ContentfulEntryNew, ContentfulRichTextRendererComponent, provideContentfulConfig } from '@ethlete/contentful';
import { RICH_TEXT_DUMMY_DATA, getRandomContents2 } from './dummy-data';

@Component({
  selector: 'ethlete-rich-test-child',
  template: `<p>{{ entry().sys.contentType.sys.id }}</p>
    <pre>{{ entry().fields | json }}</pre> `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [JsonPipe],
  hostDirectives: [],
})
export class RichTextTestChildComponent {
  includes = input();
  entry = input.required<ContentfulEntryNew<Record<string, unknown>>>();
}

@Component({
  selector: 'ethlete-rich-text',
  template: `
    <h1>Rich text</h1>
    <et-contentful-rich-text-renderer [content]="data()" />
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ContentfulRichTextRendererComponent],
  providers: [
    provideContentfulConfig({
      customComponents: {
        teaserCollection: RichTextTestChildComponent,
        shortNewsElement: RichTextTestChildComponent,
        newsElement: RichTextTestChildComponent,
        teaserHalfCollection: RichTextTestChildComponent,
        OrganizationStore: RichTextTestChildComponent,
      },
    }),
  ],
})
export class RichTextComponent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data = signal(RICH_TEXT_DUMMY_DATA as any);

  constructor() {
    setTimeout(() => {
      const content = RICH_TEXT_DUMMY_DATA.items[0]?.fields.html.content;

      if (!content) return;

      content.length = 0;
      content.push(...getRandomContents2());

      const entry = RICH_TEXT_DUMMY_DATA.includes.Entry.find((e) => e.sys.id === '2UDPAyQLxJOeXmy3mgCTk');
      if (entry?.fields.titel) {
        entry.fields.titel = 'Updated title';
      }

      this.data.set({ ...RICH_TEXT_DUMMY_DATA });
    }, 2000);
  }
}
