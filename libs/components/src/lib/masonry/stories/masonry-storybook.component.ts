import { Component, ViewEncapsulation, computed, input, signal } from '@angular/core';
import { AutoSurfaceDirective, ProvideColorDirective, ProvideSurfaceDirective } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../button';
import { MASONRY_IMPORTS } from '../masonry.imports';

const FILLER =
  'Sed euismod nisl nec ultricies. Aenean vulputate eleifend tellus. Curabitur ullamcorper ultricies nisi.';

/** The aspect ratios the media blocks cycle through, so the cards differ in height before their text does. */
const MEDIA_RATIOS = [1, 1.35, 0.8, 1.7];

type Card = {
  id: number;
  /** Paragraphs of filler, precomputed: the cards must not change shape when the view is checked again. */
  paragraphs: string[];
  mediaRatio: number;
};

/**
 * Deterministic pseudo-random, so a re-render (a control change, a Chromatic snapshot) produces the same
 * cards. `Math.random()` here would make every screenshot a different layout.
 */
const pseudoRandom = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;

  return value - Math.floor(value);
};

const createCards = (count: number): Card[] =>
  Array.from({ length: count }, (_, id) => ({
    id,
    paragraphs: Array.from({ length: 1 + Math.floor(pseudoRandom(id + 1) * 5) }, () => FILLER),
    mediaRatio: MEDIA_RATIOS[id % MEDIA_RATIOS.length] ?? 1,
  }));

@Component({
  selector: 'et-sb-masonry',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-6 p-8 font-sans">
      <div class="flex items-center gap-4">
        @if (loadMore()) {
          <!-- The handshake an infinite scroll needs: appending while the current page is still being
               measured would pack the new cards against heights that are about to change. -->
          <button [disabled]="!masonry.isSettled()" (click)="appendPage()" et-button>Load more</button>
        }

        <span class="text-small">
          {{ cards().length }} cards · {{ masonry.isSettled() ? 'settled' : 'settling' }} ·
          {{ masonry.columns().count }} columns
        </span>
      </div>

      <ul #masonry="etMasonry" [columnWidth]="columnWidth()" [gap]="gap()" class="m-0 list-none p-0" etMasonry>
        @for (card of cards(); track card.id) {
          <li
            #item="etMasonryItem"
            class="overflow-hidden rounded-lg"
            etMasonryItem
            etAutoSurface
            style="background: var(--et-surface-background-solid)"
          >
            <!-- Stands in for a photo of unknown proportions, which is what a masonry exists for. -->
            <div
              [style.aspect-ratio]="card.mediaRatio"
              etProvideColor="brand"
              style="background: var(--et-theme-color-primary-solid)"
            ></div>

            <div class="text-small flex flex-col gap-2 p-4">
              <!-- The column each card landed in, so the greedy packing can be read off the layout. -->
              <span class="opacity-60">#{{ card.id + 1 }} · column {{ item.placement()?.column ?? '—' }}</span>

              @for (paragraph of card.paragraphs; track $index) {
                <p class="m-0">{{ paragraph }}</p>
              }

              <!-- Growing a card is the case cdk's one-shot measurement could not follow: the cards below it
                   have to move down, which needs the height re-measured after the click. -->
              @if (expanded().has(card.id)) {
                <p class="m-0">{{ FILLER }} {{ FILLER }}</p>
              }

              <button (click)="toggleExpanded(card.id)" et-button variant="transparent" size="xs">
                {{ expanded().has(card.id) ? 'Show less' : 'Show more' }}
              </button>
            </div>
          </li>
        }
      </ul>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MASONRY_IMPORTS, BUTTON_IMPORTS, ProvideSurfaceDirective, AutoSurfaceDirective, ProvideColorDirective],
})
export class MasonryStorybookComponent {
  public columnWidth = input(240);
  public gap = input(16);
  public surface = input('dark');
  public itemCount = input(18);

  /** Render the append control, which is also the `isSettled` demonstration. */
  public loadMore = input(false);

  protected readonly FILLER = FILLER;

  private appendedPages = signal(0);

  protected cards = computed(() => createCards(this.itemCount() + this.appendedPages() * 6));

  /** Cards the reader has clicked, which grow. */
  protected expanded = signal(new Set<number>());

  protected appendPage() {
    this.appendedPages.update((pages) => pages + 1);
  }

  protected toggleExpanded(id: number) {
    this.expanded.update((current) => {
      const next = new Set(current);

      if (!next.delete(id)) next.add(id);

      return next;
    });
  }
}
