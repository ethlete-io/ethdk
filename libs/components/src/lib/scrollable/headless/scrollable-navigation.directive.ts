import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { signalElementDimensions, signalStyles } from '@ethlete/core';
import { EMPTY, debounceTime, filter, fromEvent, switchMap, tap } from 'rxjs';
import { ScrollableDirective } from './scrollable.directive';
import { ScrollableNavigation } from './scrollable.types';

@Component({
  selector: 'et-scrollable-navigation, [et-scrollable-navigation]',
  template: `
    <div class="et-scrollable-progress-bar">
      <div #navigationDotsContainer class="et-scrollable-dots-container">
        @for (item of navigation().items; track i; let i = $index) {
          <button
            #navigationDot
            [class.et-scrollable-navigation-item--active]="item.isActive"
            [class.et-scrollable-navigation-item--close]="
              navigation().items[i + 1]?.isActive || navigation().items[i - 1]?.isActive
            "
            [class.et-scrollable-navigation-item--far]="
              !navigation().items[i + 1]?.isActive && !navigation().items[i - 1]?.isActive && !item.isActive
            "
            [attr.active-offset]="item.activeOffset"
            (click)="scrollToElementViaNavigation(i)"
            class="et-scrollable-navigation-item"
            type="button"
            tabindex="-1"
            aria-hidden="true"
          ></button>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-scrollable-navigation',
    'aria-hidden': 'true',
  },
  styles: `
    .et-scrollable-navigation {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .et-scrollable-navigation-item {
      display: flex;
      justify-content: center;
      align-items: center;
      border: none;
      padding: 0;
      inline-size: 20px;
      block-size: 20px;
      border-radius: 50%;
      cursor: pointer;
      background-color: transparent;

      &.et-scrollable-navigation-item--active::after {
        background-color: var(--et-theme-color-primary, #c6c6c6);
      }

      &::after {
        content: '';
        display: block;
        inline-size: 50%;
        block-size: 50%;
        border-radius: 50%;
        background-color: var(--et-surface-interaction-solid, #4b4b4b);
        opacity: 0.3;
        transform: scale(0);
      }

      &[active-offset='0']::after {
        opacity: 1;
        transform: scale(1);
      }
      &[active-offset='1']::after {
        opacity: 0.6;
        transform: scale(0.75);
      }
      &[active-offset='2']::after {
        opacity: 0.45;
        transform: scale(0.6);
      }
      &[active-offset='3']::after {
        opacity: 0.35;
        transform: scale(0.5);
      }
      &[active-offset='4']::after {
        opacity: 0.3;
        transform: scale(0.4);
      }
    }

    .et-scrollable-progress-bar {
      overflow: hidden;
      max-inline-size: 100px;
      display: flex;
      align-items: center;

      .et-scrollable-dots-container {
        display: flex;
        flex-wrap: nowrap;
      }
    }
  `,
})
export class ScrollableNavigationDirective {
  protected scrollable = inject(ScrollableDirective);

  private navigationDotsContainer = viewChild<ElementRef<HTMLElement>>('navigationDotsContainer');
  private firstNavigationDot = viewChild<ElementRef<HTMLButtonElement>>('navigationDot');

  private navigationDotDimensions = signalElementDimensions(this.firstNavigationDot);

  private manualActiveNavigationIndex = signal<number | null>(null);

  public navigation = computed<ScrollableNavigation>(
    () => {
      const allIntersections = this.scrollable.childIntersections();
      const manualActiveIndex = this.manualActiveNavigationIndex();
      const isAtStart = this.scrollable.isAtStart();
      const isAtEnd = this.scrollable.isAtEnd();

      const firstIntersection = allIntersections[0];
      const lastIntersection = allIntersections[allIntersections.length - 1];

      const highestIntersection = isAtStart
        ? firstIntersection
        : isAtEnd
          ? lastIntersection
          : allIntersections.reduce((prev, curr) => {
              if (prev && prev.intersectionRatio > curr.intersectionRatio) return prev;
              return curr;
            }, allIntersections[0]);

      if (!highestIntersection) {
        return { items: [], activeIndex: -1 };
      }

      const activeIndex =
        manualActiveIndex !== null ? manualActiveIndex : allIntersections.findIndex((i) => i === highestIntersection);

      const items = allIntersections.map((i, index) => ({
        isActive:
          manualActiveIndex !== null
            ? manualActiveIndex === index
            : i === highestIntersection && highestIntersection.intersectionRatio > 0,
        activeOffset: index === activeIndex ? 0 : Math.abs(index - activeIndex),
        element: i.target as HTMLElement,
      }));

      return { items, activeIndex };
    },
    {
      equal: (a, b) =>
        a.activeIndex === b.activeIndex &&
        a.items.length === b.items.length &&
        a.items.every((v, i) => v.isActive === b.items[i]?.isActive && v.activeOffset === b.items[i]?.activeOffset),
    },
  );

  public activeIndex = computed(() => this.navigation().activeIndex);

  /** @internal */
  public dotsContainerStyleBindings = signalStyles(this.navigationDotsContainer, {
    transform: computed(() => {
      const activeIdx = this.navigation().activeIndex;
      const childCount = this.navigation().items.length;
      let offset = '0px';

      if (childCount > 5) {
        const dotContainerWidth = this.navigationDotDimensions().client?.width ?? 20;
        let offsetValue = -(activeIdx - 2);

        if (activeIdx < 3) {
          offsetValue = 0;
        } else if (activeIdx >= childCount - 3) {
          offsetValue = 5 - childCount;
        }

        offset = `${offsetValue * dotContainerWidth}px`;
      }

      const dir = this.scrollable.direction() === 'horizontal' ? 'X' : 'Y';

      return `translate${dir}(${offset})`;
    }),
  });

  constructor() {
    this.scrollable.activateChildIntersections();
    this.scrollable.navigationDirective.set(this);

    const scrollContainerRef$ = toObservable(this.scrollable.getScrollContainerRef());

    toObservable(this.manualActiveNavigationIndex)
      .pipe(
        takeUntilDestroyed(),
        filter((i) => i !== null),
        switchMap(() =>
          scrollContainerRef$.pipe(
            switchMap((ref) => {
              if (!ref) return EMPTY;
              // FIXME: eslint prefers signalElementScrollState but this pattern is intentional for debouncing
              // eslint-disable-next-line ethlete/prefer-scroll-state
              return fromEvent(ref.nativeElement, 'scroll');
            }),
          ),
        ),
        debounceTime(50),
        tap(() => this.manualActiveNavigationIndex.set(null)),
      )
      .subscribe();
  }

  public scrollToElementViaNavigation(elementIndex: number) {
    const element = this.scrollable.scrollableChildren()[elementIndex];
    if (!element) return;

    this.manualActiveNavigationIndex.set(elementIndex);
    this.scrollable.scrollToElement({ element });
  }
}
