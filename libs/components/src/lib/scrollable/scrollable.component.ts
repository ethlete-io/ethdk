import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { outputFromObservable, takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  ProvideColorDirective,
  ScrollObserverDirective,
  ScrollObserverEndDirective,
  ScrollObserverStartDirective,
  createCanAnimateSignal,
  signalClasses,
} from '@ethlete/core';
import { debounceTime, map, tap } from 'rxjs';
import { ScrollableButtonsDirective } from './headless/scrollable-buttons.directive';
import { ScrollableDarkenDirective } from './headless/scrollable-darken.directive';
import { ScrollableDragDirective } from './headless/scrollable-drag.directive';
import { ScrollableIgnoreChildDirective } from './headless/scrollable-ignore-child.directive';
import { ScrollableMasksDirective } from './headless/scrollable-masks.directive';
import { ScrollableNavigationDirective } from './headless/scrollable-navigation.directive';
import { ScrollableSnapDirective } from './headless/scrollable-snap.directive';
import { ScrollableDirective } from './headless/scrollable.directive';
import {
  ScrollableButtonPosition,
  ScrollableIntersectionChange,
  ScrollableLoadingTemplatePosition,
  ScrollableMaskVariant,
  ScrollableScrollState,
} from './headless/scrollable.types';

@Component({
  selector: 'et-scrollable',
  templateUrl: './scrollable.component.html',
  styleUrl: './scrollable.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ScrollObserverDirective,
    ScrollObserverStartDirective,
    ScrollObserverEndDirective,
    ScrollableIgnoreChildDirective,
    ScrollableMasksDirective,
    ScrollableButtonsDirective,
    ScrollableNavigationDirective,
    ScrollableSnapDirective,
    ScrollableDragDirective,
    ScrollableDarkenDirective,
    NgTemplateOutlet,
  ],
  hostDirectives: [
    {
      directive: ScrollableDirective,
      inputs: ['itemSize', 'direction', 'scrollMode', 'scrollOrigin', 'scrollMargin', 'renderScrollbars'],
    },
    {
      directive: ProvideColorDirective,
      inputs: ['etProvideColor:color'],
    },
  ],
  host: {
    class: 'et-scrollable',
    '[class.et-scrollable--can-animate]': 'canAnimate.state()',
    '[class.et-scrollable--darken-non-intersecting-items]': 'darkenNonIntersectingItems()',
    '[class.et-scrollable--sticky-buttons]': 'stickyButtons() && renderButtonsInside()',
    '[attr.mask-variant]': 'maskVariant()',
  },
})
export class ScrollableComponent {
  public scrollableDir = inject(ScrollableDirective);

  public renderMasks = input(true);
  public maskVariant = input<ScrollableMaskVariant>('gradient');
  public renderButtons = input(true);
  public buttonPosition = input<ScrollableButtonPosition>('inside');
  public renderNavigation = input(false);
  public snap = input(false);
  public cursorDragScroll = input(true);
  public darkenNonIntersectingItems = input(false);
  public stickyButtons = input(false);
  public showLoadingTemplate = input(false);
  public loadingTemplatePosition = input<ScrollableLoadingTemplatePosition>('end');
  public scrollableRole = input<string | null>(null);
  public scrollableClass = input<string | null>(null);

  public intersectionChange = outputFromObservable<ScrollableIntersectionChange[]>(
    toObservable(this.scrollableDir.childIntersections).pipe(
      takeUntilDestroyed(),
      debounceTime(50),
      map((entries) =>
        entries.map((i, index) => ({
          index,
          element: i.target as HTMLElement,
          intersectionRatio: i.intersectionRatio,
          isIntersecting: i.isIntersecting,
        })),
      ),
    ),
  );

  public scrollStateChange = outputFromObservable<ScrollableScrollState>(
    toObservable(
      computed(() => ({
        canScroll: this.scrollableDir.canScroll(),
        isAtEnd: this.scrollableDir.isAtEnd(),
        isAtStart: this.scrollableDir.isAtStart(),
      })),
    ),
  );

  private scrollContainerEl = viewChild<ElementRef<HTMLElement>>('scrollable');
  private scrollObserver = viewChild.required(ScrollObserverDirective);

  public renderButtonsInside = computed(() => this.buttonPosition() === 'inside' && this.renderButtons());
  public renderButtonsInFooter = computed(() => this.buttonPosition() === 'footer' && this.renderButtons());
  public canAnimate = createCanAnimateSignal();

  constructor() {
    const scrollContainerEl$ = toObservable(this.scrollContainerEl);
    const scrollObserver$ = toObservable(this.scrollObserver);

    scrollContainerEl$
      .pipe(
        takeUntilDestroyed(),
        tap((el) => {
          if (el) this.scrollableDir.scrollContainerRef.set(el);
        }),
      )
      .subscribe();

    scrollObserver$
      .pipe(
        takeUntilDestroyed(),
        tap((obs) => {
          if (obs) this.scrollableDir.scrollObserverRef.set(obs);
        }),
      )
      .subscribe();

    signalClasses(this.scrollableDir.scrollableChildren, {
      'et-scrollable-item': computed(() => true),
    });
  }
}
