import { Component, ViewEncapsulation, signal } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { BUTTON_IMPORTS, MASONRY_IMPORTS } from '@ethlete/components';
import { MASONRY_FILLER, createCards } from './masonry.data';

@Component({
  selector: 'app-masonry-default-example',
  template: `
    <p class="example-masonry-toolbar">
      {{ CARDS.length }} cards · {{ masonry.isSettled() ? 'settled' : 'settling' }} ·
      {{ masonry.columns().count }} columns
    </p>

    <ul #masonry="etMasonry" [columnWidth]="240" [gap]="16" class="example-masonry" etMasonry>
      @for (card of CARDS; track card.id) {
        <li #item="etMasonryItem" class="example-masonry-card" etMasonryItem etAutoSurface>
          <div [style.aspect-ratio]="card.mediaRatio" class="example-masonry-media"></div>

          <div class="example-masonry-body">
            <span class="example-masonry-meta">#{{ card.id + 1 }} · column {{ item.placement()?.column ?? '-' }}</span>

            @for (paragraph of card.paragraphs; track $index) {
              <p>{{ paragraph }}</p>
            }

            @if (expanded().has(card.id)) {
              <p>{{ FILLER }} {{ FILLER }}</p>
            }

            <button (click)="toggleExpanded(card.id)" et-button variant="transparent" size="xs">
              {{ expanded().has(card.id) ? 'Show less' : 'Show more' }}
            </button>
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
export class MasonryDefaultExampleComponent {
  protected readonly FILLER = MASONRY_FILLER;
  protected readonly CARDS = createCards(18);
  protected expanded = signal(new Set<number>());

  protected toggleExpanded(id: number) {
    this.expanded.update((current) => {
      const next = new Set(current);

      if (!next.delete(id)) next.add(id);

      return next;
    });
  }
}
