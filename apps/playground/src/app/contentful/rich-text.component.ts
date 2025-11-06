import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  ContentfulEntrySys,
  ContentfulIncludeMap,
  ContentfulMetadata,
  ContentfulRichTextRendererComponent,
  provideContentfulConfig,
} from '@ethlete/contentful';
import { clone } from '@ethlete/core';
import { RICH_TEXT_DUMMY_DATA, getRandomContents, getRandomContents2 } from './dummy-data';
import { CONTENTFUL_DUMMY_DATA_2 } from './dummy-data-2';
import { CONTENTFUL_DUMMY_DATA_3 } from './dummy-data-3';

@Component({
  selector: 'ethlete-rich-test-org-store',
  template: `<p>{{ sys().contentType.sys.id }}</p>
    <pre>{{ fields() | json }}</pre> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [JsonPipe],
  hostDirectives: [],
})
export class RichTextTestOrganizationStoreComponent {
  fields = input.required<unknown>();
  sys = input.required<ContentfulEntrySys>();

  includes = input.required<ContentfulIncludeMap>();
  myThing = computed(() => this.includes().getEntry('someId', 'my-content-type'));
}

@Component({
  selector: 'ethlete-rich-test-teaser-half-collection',
  template: `<p>{{ sys().contentType.sys.id }}</p>
    <pre>{{ fields() | json }}</pre> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [JsonPipe],
  hostDirectives: [],
})
export class RichTextTestTeaserHalfCollectionComponent {
  includes = input.required<ContentfulIncludeMap>();
  fields = input.required<unknown>();
  sys = input.required<ContentfulEntrySys>();
}

@Component({
  selector: 'ethlete-rich-test-news-element',
  template: `<p>{{ sys().contentType.sys.id }}</p>
    <pre>{{ fields() | json }}</pre> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [JsonPipe],
  hostDirectives: [],
})
export class RichTextTestNewsElementComponent {
  includes = input.required<ContentfulIncludeMap>();
  fields = input.required<unknown>();
  sys = input.required<ContentfulEntrySys>();
}

@Component({
  selector: 'ethlete-rich-test-short-news-element',
  template: `
    <p>{{ sys().contentType.sys.id }}</p>
    <pre>{{ fields() | json }}</pre>
    <button (click)="buttonClick()">Click me</button>
    <p>Clicks: {{ clicks() }}</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [JsonPipe],
  hostDirectives: [],
})
export class RichTextTestShortNewsElementComponent {
  includes = input.required<ContentfulIncludeMap>();
  fields = input.required<unknown>();
  sys = input.required<ContentfulEntrySys>();

  clicks = signal(0);

  changeDetectorRef = inject(ChangeDetectorRef);

  constructor() {
    effect(() => console.log(this.fields()));
  }

  buttonClick() {
    this.clicks.set(this.clicks() + 1);
  }
}

@Component({
  selector: 'ethlete-rich-test-teaser-collection',
  template: `<p>{{ sys().contentType.sys.id }}</p>
    <pre>{{ fields() | json }}</pre> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [JsonPipe],
  hostDirectives: [],
})
export class RichTextTestTeaserCollectionComponent {
  includes = input.required<ContentfulIncludeMap>();
  fields = input.required<unknown>();
  metadata = input.required<ContentfulMetadata>();
  sys = input.required<ContentfulEntrySys>();
}

@Component({
  selector: 'ethlete-rich-text',
  template: `
    <h1>Rich text</h1>
    <button (click)="render1()">Render rich text 1</button>
    <button (click)="render2()">Render rich text 2</button>
    <button (click)="render3()">Update short news element name</button>
    <button (click)="render4()">Render dummy content 2</button>
    <button (click)="render5()">Render dummy content 3</button>
    <et-contentful-rich-text-renderer [content]="data()" richTextPath="items[0].fields.html" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ContentfulRichTextRendererComponent],
  providers: [
    provideContentfulConfig({
      customComponents: {
        teaserCollection: RichTextTestTeaserCollectionComponent,
        shortNewsElement: RichTextTestShortNewsElementComponent,
        newsElement: RichTextTestNewsElementComponent,
        teaserHalfCollection: RichTextTestTeaserHalfCollectionComponent,
        OrganizationStore: RichTextTestOrganizationStoreComponent,
      },
    }),
  ],
})
export class RichTextComponent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data = signal(clone(RICH_TEXT_DUMMY_DATA) as any);

  updateCount = 0;

  render1() {
    const data = clone(RICH_TEXT_DUMMY_DATA);

    const content = data.items[0]?.fields.html.content;

    if (!content) return;

    content.length = 0;
    content.push(...getRandomContents());

    this.data.set(data);
  }

  render2() {
    const data = clone(RICH_TEXT_DUMMY_DATA);
    const content = data.items[0]?.fields.html.content;

    if (!content) return;

    content.length = 0;
    content.push(...getRandomContents2());

    this.data.set(data);
  }

  render3() {
    this.updateCount += 1;

    const data = clone(this.data());

    const entry = data.includes.Entry.find((e: any) => e.sys.id === '1dpXB34M54E4Qm7U5Ox2R3');
    if (entry?.fields.name) {
      entry.fields.name = 'This is updated. The count of total updates is ' + this.updateCount;

      console.log('Updated entry:', this.updateCount);
    }

    console.log(entry);

    this.data.set(data);
  }

  render4() {
    this.data.set(CONTENTFUL_DUMMY_DATA_2);
  }

  render5() {
    this.data.set(CONTENTFUL_DUMMY_DATA_3);
  }
}
