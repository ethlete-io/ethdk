import { Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { BUTTON_IMPORTS, MASONRY_IMPORTS } from '@ethlete/components';
import { createCards } from './masonry.data';

@Component({
  selector: 'app-masonry-appending-items-example',
  template: `
    <div class="example-masonry-toolbar">
      <button [disabled]="!masonry.isSettled()" (click)="appendPage()" et-button>Load more</button>

      <span>
        {{ cards().length }} cards · {{ masonry.isSettled() ? 'settled' : 'settling' }} ·
        {{ masonry.columns().count }} columns
      </span>
    </div>

    <ul #masonry="etMasonry" [columnWidth]="240" [gap]="16" class="example-masonry" etMasonry>
      @for (card of cards(); track card.id) {
        <li #item="etMasonryItem" class="example-masonry-card" etMasonryItem etAutoSurface>
          <div [style.aspect-ratio]="card.mediaRatio" class="example-masonry-media"></div>

          <div class="example-masonry-body">
            <span class="example-masonry-meta">#{{ card.id + 1 }} · column {{ item.placement()?.column ?? '-' }}</span>

            @for (paragraph of card.paragraphs; track $index) {
              <p>{{ paragraph }}</p>
            }
          </div>
        </li>
      }
    </ul>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MASONRY_IMPORTS, BUTTON_IMPORTS, AutoSurfaceDirective],
  styles: `
    .example-masonry {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .example-masonry-card {
      overflow: hidden;
      border-radius: 8px;
      background: var(--et-surface-background-solid);
    }

    .example-masonry-media {
      background: var(--et-theme-color-primary-solid);
    }

    .example-masonry-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
    }

    .example-masonry-body p {
      margin: 0;
    }

    .example-masonry-meta {
      opacity: 0.6;
    }

    .example-masonry-toolbar {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-block-end: 16px;
    }
  `,
})
export class MasonryAppendingItemsExampleComponent {
  private appendedPages = signal(0);

  protected cards = computed(() => createCards(18 + this.appendedPages() * 6));

  protected appendPage() {
    this.appendedPages.update((pages) => pages + 1);
  }
}
