import { Component, ViewEncapsulation, computed, input, linkedSignal } from '@angular/core';
import { clone } from '@ethlete/core';
import {
  CONTENTFUL_DEFAULT_COMPONENTS,
  ContentfulCollection,
  ContentfulEntry,
  ContentfulEntrySys,
  ContentfulIncludeMap,
  ContentfulRichTextRendererComponent,
  provideContentfulConfig,
} from '@ethlete/contentful';
import { CALLOUT_ENTRY_ID, RICH_TEXT_EMBEDS } from './embedded-entries.data';

@Component({
  selector: 'app-callout',
  template: `
    <p class="app-callout-title">{{ fields().title }}</p>
    <p>{{ fields().body }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-callout' },
  styles: `
    .app-callout {
      display: block;
      margin-block: 16px;
      padding: 16px;
      border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
      border-radius: 8px;
    }

    .app-callout-title {
      text-transform: uppercase;
      opacity: 0.6;
    }
  `,
})
export class CalloutComponent {
  public fields = input.required<{ title: string; body: string }>();
}

@Component({
  selector: 'app-stat-card',
  template: `
    <p class="app-stat-card-label">{{ fields().label }}</p>
    <p class="app-stat-card-value">{{ fields().value }}</p>
    <p>{{ fields().trend }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-stat-card' },
  styles: `
    .app-stat-card {
      display: block;
      margin-block: 16px;
      padding: 16px;
      border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
      border-radius: 8px;
    }

    .app-stat-card-label {
      text-transform: uppercase;
      opacity: 0.6;
    }

    .app-stat-card-value {
      font-size: 24px;
    }
  `,
})
export class StatCardComponent {
  public fields = input.required<{ label: string; value: string; trend: string }>();
}

@Component({
  selector: 'app-product-teaser',
  template: `<b>{{ fields().name }}</b> ({{ contentTypeId() }}, sibling callout: "{{ calloutTitle() }}")`,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-product-teaser' },
  styles: `
    .app-product-teaser {
      display: inline;
    }
  `,
})
export class ProductTeaserComponent {
  public fields = input.required<{ name: string }>();
  public sys = input.required<ContentfulEntrySys>();
  public includes = input.required<ContentfulIncludeMap>();

  protected contentTypeId = computed(() => this.sys().contentType.sys.id);
  protected calloutTitle = computed(
    () => this.includes().getEntry<{ title: string }>(CALLOUT_ENTRY_ID, 'callout')?.fields.title,
  );
}

@Component({
  selector: 'app-embedded-entries-example',
  template: `
    <div class="app-rich-text-toolbar">
      <button (click)="renameCallout()" type="button">Rename the callout entry</button>
      <button (click)="reset()" type="button">Reset</button>
    </div>

    <et-contentful-rich-text-renderer [content]="content()" richTextPath="items[0].fields.html" />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ContentfulRichTextRendererComponent],
  providers: [
    provideContentfulConfig({
      ...CONTENTFUL_DEFAULT_COMPONENTS,
      customComponents: {
        callout: CalloutComponent,
        statCard: StatCardComponent,
        productTeaser: ProductTeaserComponent,
      },
    }),
  ],
  styles: `
    .app-rich-text-toolbar {
      display: flex;
      gap: 8px;
      margin-block-end: 24px;
    }
  `,
})
export class EmbeddedEntriesExampleComponent {
  private renameCount = 0;

  protected content = linkedSignal<ContentfulCollection>(() => clone(RICH_TEXT_EMBEDS));

  protected renameCallout() {
    this.renameCount += 1;

    const next = clone(this.content());
    const callout = (next.includes?.Entry as ContentfulEntry<{ title: string }>[] | undefined)?.find(
      (candidate) => candidate.sys.id === CALLOUT_ENTRY_ID,
    );

    if (!callout) return;

    callout.fields.title = `Renamed ${this.renameCount}×`;
    this.content.set(next);
  }

  protected reset() {
    this.renameCount = 0;
    this.content.set(clone(RICH_TEXT_EMBEDS));
  }
}
