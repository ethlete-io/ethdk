import { Component, ViewEncapsulation, computed, input, linkedSignal } from '@angular/core';
import { clone } from '@ethlete/core';
import { ContentfulIncludeMap, ContentfulRichTextRendererComponent } from '../components/rich-text-renderer';
import { ContentfulCollection, ContentfulEntry, ContentfulEntrySys } from '../types';
import { provideContentfulConfig } from '../utils/contentful.util';
import { CALLOUT_ENTRY_ID, RICH_TEXT_EMBEDS, RICH_TEXT_LISTS, RICH_TEXT_TABLES } from './rich-text-fixtures';

export type RichTextFixture = 'embeds' | 'lists' | 'tables';

const FIXTURES: Record<RichTextFixture, ContentfulCollection> = {
  embeds: RICH_TEXT_EMBEDS,
  lists: RICH_TEXT_LISTS,
  tables: RICH_TEXT_TABLES,
};

@Component({
  selector: 'et-sb-rich-text-callout',
  template: `
    <p class="text-medium uppercase opacity-60">{{ fields().title }}</p>
    <p>{{ fields().body }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'block border border-white/20 rounded-lg p-4 my-4' },
})
export class RichTextCalloutComponent {
  fields = input.required<{ title: string; body: string }>();
}

@Component({
  selector: 'et-sb-rich-text-stat-card',
  template: `
    <p class="text-small uppercase opacity-60">{{ fields().label }}</p>
    <p class="text-h3">{{ fields().value }}</p>
    <p class="text-small">{{ fields().trend }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'block border border-white/20 rounded-lg p-4 my-4' },
})
export class RichTextStatCardComponent {
  fields = input.required<{ label: string; value: string; trend: string }>();
}

/**
 * Declares `sys` and `includes` as well as `fields`, so the story shows that a custom component may
 * take any subset of the renderer's inputs and look other entries up through the include map.
 */
@Component({
  selector: 'et-sb-rich-text-product-teaser',
  template: `<b>{{ fields().name }}</b>
    <span class="opacity-60">({{ contentTypeId() }}, sibling callout: "{{ calloutTitle() }}")</span>`,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'inline' },
})
export class RichTextProductTeaserComponent {
  fields = input.required<{ name: string }>();
  sys = input.required<ContentfulEntrySys>();
  includes = input.required<ContentfulIncludeMap>();

  contentTypeId = computed(() => this.sys().contentType.sys.id);
  calloutTitle = computed(() => this.includes().getEntry<{ title: string }>(CALLOUT_ENTRY_ID, 'callout')?.fields.title);
}

@Component({
  selector: 'et-sb-rich-text',
  template: `
    @if (fixture() === 'embeds') {
      <div class="mb-6 flex flex-wrap gap-2">
        <button (click)="renameCallout()" class="rounded border border-white/20 px-3 py-2" type="button">
          Rename the callout entry
        </button>
        <button (click)="reset()" class="rounded border border-white/20 px-3 py-2" type="button">Reset</button>
      </div>
    }

    <et-contentful-rich-text-renderer [content]="content()" richTextPath="items[0].fields.html" />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ContentfulRichTextRendererComponent],
  providers: [
    provideContentfulConfig({
      customComponents: {
        callout: RichTextCalloutComponent,
        statCard: RichTextStatCardComponent,
        productTeaser: RichTextProductTeaserComponent,
      },
    }),
  ],
  host: { class: 'block font-sans' },
})
export class RichTextStorybookComponent {
  fixture = input<RichTextFixture>('embeds');

  content = linkedSignal(() => clone(FIXTURES[this.fixture()]));

  private renameCount = 0;

  /**
   * Mutates one entry inside `includes` and sets a new collection. The renderer keeps the DOM it
   * already built and only re-binds the affected custom component.
   */
  renameCallout() {
    this.renameCount += 1;

    const next = clone(this.content());
    const callout = (next.includes?.Entry as ContentfulEntry<{ title: string }>[] | undefined)?.find(
      (candidate) => candidate.sys.id === CALLOUT_ENTRY_ID,
    );

    if (!callout) return;

    callout.fields.title = `Renamed ${this.renameCount}×`;
    this.content.set(next);
  }

  reset() {
    this.renameCount = 0;
    this.content.set(clone(FIXTURES[this.fixture()]));
  }
}
