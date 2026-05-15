import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, signal, viewChild } from '@angular/core';
import { BUTTON_IMPORTS } from '../../../button';
import {
  ScrollableButtonPosition,
  ScrollableDirection,
  ScrollableItemSize,
  ScrollableMaskVariant,
  ScrollableScrollMode,
  ScrollableScrollOrigin,
} from '../../headless';
import { ScrollableActiveChildDirective } from '../../headless/scrollable-active-child.directive';
import { ScrollableComponent } from '../../scrollable.component';
import { SCROLLABLE_IMPORTS } from '../../scrollable.imports';

const ITEM_COLORS = ['#7c3aed', '#c026d3', '#db2777', '#e11d48', '#ea580c', '#d97706', '#059669'] as const;

const SCROLLABLE_ITEMS = Array.from({ length: 7 }, (_, i) => ({
  index: i,
  label: `Item ${i}`,
  active: i === 3 || i === 4,
  color: ITEM_COLORS[i],
}));

@Component({
  selector: 'et-sb-scrollable',
  template: `
    <div class="flex flex-col gap-6">
      <div class="flex gap-3">
        <button (click)="makeScrollable.set(!makeScrollable())" variant="outline" size="sm" et-button type="button">
          {{ makeScrollable() ? 'Reduce items' : 'Show all items' }}
        </button>
        <button (click)="scrollToIndex(4)" variant="outline" size="sm" et-button type="button">
          Scroll to index 4
        </button>
      </div>

      <et-scrollable
        [stickyButtons]="stickyButtons()"
        [itemSize]="itemSize()"
        [direction]="direction()"
        [color]="color()"
        [scrollableRole]="scrollableRole() ?? null"
        [scrollableClass]="scrollableClass()"
        [renderMasks]="renderMasks()"
        [maskVariant]="maskVariant()"
        [renderButtons]="renderButtons()"
        [renderScrollbars]="renderScrollbars()"
        [cursorDragScroll]="cursorDragScroll()"
        [renderNavigation]="renderNavigation()"
        [buttonPosition]="buttonPosition()"
        [scrollMode]="scrollMode()"
        [snap]="snap()"
        [scrollMargin]="scrollMargin()"
        [scrollOrigin]="scrollOrigin()"
        [darkenNonIntersectingItems]="darkenNonIntersectingItems()"
      >
        @for (item of ITEMS; track item.index) {
          @if (item.index < 2 || makeScrollable()) {
            <button
              [etScrollableActiveChild]="item.active"
              [style.background-color]="item.color"
              (click)="doClick(item.index)"
              class="et-sb-scrollable-item"
            >
              {{ item.label }}
            </button>
          }
        }
      </et-scrollable>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SCROLLABLE_IMPORTS, ScrollableActiveChildDirective, BUTTON_IMPORTS],
  styles: `
    .et-sb-scrollable-item {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 200px;
      min-height: 80px;
      height: 100%;
      border: none;
      border-radius: 12px;
      font-size: 1.125rem;
      font-weight: 600;
      color: #fff;
      cursor: pointer;
      transition: transform 150ms ease;
    }

    .et-sb-scrollable-item:hover {
      transform: scale(1.02);
    }

    .et-sb-scrollable-item:active {
      transform: scale(0.98);
    }

    .et-scrollable {
      &[direction='vertical'] {
        width: min(80vw, 400px);

        .et-scrollable-container {
          height: 250px;
        }
      }
    }

    .et-scrollable-container {
      height: 120px;
      gap: 12px;
    }

    .et-scrollable.et-scrollable--sticky-buttons .et-scrollable-container {
      height: 800px;
    }
  `,
})
export class ScrollableStorybookComponent {
  color = input<string | null>(null);
  itemSize = input<ScrollableItemSize>('auto');
  direction = input<ScrollableDirection>('horizontal');
  scrollableRole = input<string>();
  scrollableClass = input<string | null>(null);
  renderMasks = input(true);
  maskVariant = input<ScrollableMaskVariant>('gradient');
  renderButtons = input(true);
  renderScrollbars = input(false);
  stickyButtons = input(false);
  cursorDragScroll = input(true);
  snap = input(false);
  renderNavigation = input(false);
  buttonPosition = input<ScrollableButtonPosition>('inside');
  scrollOrigin = input<ScrollableScrollOrigin>('auto');
  scrollMode = input<ScrollableScrollMode>('container');
  scrollMargin = input(0);
  darkenNonIntersectingItems = input(false);

  scrollable = viewChild.required(ScrollableComponent);
  makeScrollable = signal(true);
  readonly ITEMS = SCROLLABLE_ITEMS;

  scrollToIndex(index: number) {
    this.scrollable().scrollableDir.scrollToElementByIndex({ index });
  }

  // eslint-disable-next-line ethlete/no-trivial-wrapper-method
  doClick(item: number) {
    alert(item);
  }
}
