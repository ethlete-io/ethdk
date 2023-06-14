import { NgClass, NgIf } from '@angular/common';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnInit,
  Output,
  Renderer2,
  ViewChild,
  ViewEncapsulation,
  booleanAttribute,
  inject,
  isDevMode,
  numberAttribute,
} from '@angular/core';
import {
  CursorDragScrollDirective,
  IS_ACTIVE_ELEMENT,
  IS_ELEMENT,
  IsActiveElementDirective,
  IsElementDirective,
  LetDirective,
  NgClassType,
  ObserveScrollStateDirective,
  ScrollObserverScrollState,
  ScrollToElementOptions,
  TypedQueryList,
  createDestroy,
  equal,
  getElementVisibleStates,
  scrollToElement,
} from '@ethlete/core';
import { BehaviorSubject, debounceTime, fromEvent, merge, startWith, takeUntil, tap } from 'rxjs';
import { ChevronIconComponent } from '../../../icons';
import { ScrollableIntersectionChange, ScrollableScrollMode } from '../../types';

@Component({
  selector: 'et-scrollable',
  templateUrl: './scrollable.component.html',
  styleUrls: ['./scrollable.component.scss'],
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CursorDragScrollDirective, ObserveScrollStateDirective, NgClass, NgIf, LetDirective, ChevronIconComponent],
  host: {
    class: 'et-scrollable',
  },
})
export class ScrollableComponent implements OnInit, AfterContentInit {
  private readonly _destroy$ = createDestroy();
  private readonly _renderer = inject(Renderer2);
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private _isCursorDragging$ = new BehaviorSubject<boolean>(false);

  @Input()
  @HostBinding('attr.item-size')
  itemSize: 'auto' | 'same' = 'auto';

  @Input()
  @HostBinding('attr.direction')
  direction: 'horizontal' | 'vertical' = 'horizontal';

  @Input()
  scrollableRole?: string;

  @Input()
  scrollableClass?: NgClassType;

  @Input({ transform: booleanAttribute })
  renderMasks = true;

  @Input({ transform: booleanAttribute })
  renderButtons = true;

  @Input({ transform: booleanAttribute })
  @HostBinding('attr.render-scrollbars')
  renderScrollbars = false;

  @Input({ transform: booleanAttribute })
  @HostBinding('attr.sticky-buttons')
  stickyButtons = false;

  @Input({ transform: booleanAttribute })
  cursorDragScroll = true;

  @Input({ transform: booleanAttribute })
  disableActiveElementScrolling = false;

  @Input()
  scrollMode: ScrollableScrollMode = 'container';

  @Input({ transform: booleanAttribute })
  snap = false;

  @Input({ transform: numberAttribute })
  scrollMargin = 0;

  @Output()
  readonly scrollStateChange = new EventEmitter<ScrollObserverScrollState>();

  @Output()
  readonly intersectionChange = new EventEmitter<ScrollableIntersectionChange[]>();

  @ViewChild('scrollable', { static: true })
  scrollable!: ElementRef<HTMLElement>;

  @ContentChildren(IS_ACTIVE_ELEMENT, { descendants: true })
  activeElements: TypedQueryList<IsActiveElementDirective> | null = null;

  @ContentChildren(IS_ELEMENT, { descendants: true })
  elements: TypedQueryList<IsElementDirective> | null = null;

  protected readonly scrollState$ = new BehaviorSubject<ScrollObserverScrollState | null>(null);

  ngOnInit(): void {
    this.scrollState$
      .pipe(
        tap((state) => {
          if (!state) {
            return;
          }

          const element = this._elementRef.nativeElement;

          this._renderer.setAttribute(element, 'at-start', state.isAtStart.toString());
          this._renderer.setAttribute(element, 'at-end', state.isAtEnd.toString());
          this._renderer.setAttribute(element, 'can-scroll', state.canScroll.toString());
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();

    this._setupScrollListening();
  }

  ngAfterContentInit(): void {
    if (!this.activeElements || !this.elements) {
      return;
    }

    this.activeElements.changes
      .pipe(
        startWith(this.activeElements),
        tap((activeElements) => {
          if (this.disableActiveElementScrolling) {
            return;
          }

          const firstActive = activeElements
            .filter((a): a is IsActiveElementDirective => !!a)
            .find((a) => a.isActiveElement);

          if (!firstActive) {
            return;
          }

          scrollToElement({
            behavior: 'auto',
            container: this.scrollable.nativeElement,
            element: firstActive.elementRef.nativeElement,
            scrollInlineMargin: this.direction === 'horizontal' ? this.scrollMargin : 0,
            scrollBlockMargin: this.direction === 'horizontal' ? 0 : this.scrollMargin,
          });
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  scrollOneContainerSize(direction: 'start' | 'end') {
    const scrollElement = this.scrollable.nativeElement;
    const parent = this._elementRef.nativeElement;

    const scrollableSize = this.direction === 'horizontal' ? parent.clientWidth : parent.clientHeight;
    const currentScroll = this.direction === 'horizontal' ? scrollElement.scrollLeft : scrollElement.scrollTop;

    scrollElement.scrollTo({
      [this.direction === 'horizontal' ? 'left' : 'top']:
        currentScroll + (direction === 'start' ? -scrollableSize : scrollableSize),
      behavior: 'smooth',
    });
  }

  scrollOneItemSize(direction: 'start' | 'end') {
    const elements = this.elements?.toArray() ?? [];

    if (!elements.length) {
      if (isDevMode()) {
        console.warn(
          'No elements found to scroll to. Make sure to apply the isElement directive to the elements you want to scroll to.',
        );
      }
      return;
    }

    const scrollElement = this.scrollable.nativeElement;
    const parent = this._elementRef.nativeElement;

    const currentScroll = this.direction === 'horizontal' ? scrollElement.scrollLeft : scrollElement.scrollTop;

    const scrollableElements = elements.filter((e) => {
      if (!e) return false;

      const rect = e.elementRef.nativeElement.getBoundingClientRect();

      if (this.direction === 'horizontal') {
        return direction === 'start' ? rect.left < 0 : rect.right > parent.clientWidth;
      } else {
        return direction === 'start' ? rect.top < 0 : rect.bottom > parent.clientHeight;
      }
    });

    if (!scrollableElements.length) {
      return;
    }

    const scrollableElementRef =
      direction === 'start' ? scrollableElements[scrollableElements.length - 1] : scrollableElements[0];

    if (!scrollableElementRef) {
      return;
    }

    const scrollableElement = scrollableElementRef.elementRef.nativeElement;
    const scrollableElementRect = scrollableElement.getBoundingClientRect();

    const scrollContainerSize = this.direction === 'horizontal' ? parent.clientWidth : parent.clientHeight;
    const docSize = this.direction === 'horizontal' ? document.body.clientWidth : document.body.clientHeight;

    const offsetSize = docSize - scrollContainerSize;
    const offset = offsetSize ? offsetSize / 2 : 0;
    const scrollFor = Math.round(currentScroll + scrollableElementRect.left - offset);

    scrollElement.scrollTo({
      [this.direction === 'horizontal' ? 'left' : 'top']: scrollFor,
      behavior: 'smooth',
    });
  }

  scrollToElement(options: Omit<ScrollToElementOptions, 'container'>) {
    const scrollElement = this.scrollable.nativeElement;

    scrollToElement({
      container: scrollElement,
      ...options,
    });
  }

  scrollToElementByIndex(options: Omit<ScrollToElementOptions, 'container'> & { index: number }) {
    const elements = this.elements?.toArray() ?? [];

    if (!elements.length) {
      if (isDevMode()) {
        console.warn(
          'No elements found to scroll to. Make sure to apply the isElement directive to the elements you want to scroll to.',
        );
      }
      return;
    }

    const scrollElement = this.scrollable.nativeElement;
    const element = elements[options.index]?.elementRef.nativeElement;

    scrollToElement({
      container: scrollElement,
      element,
      ...options,
    });
  }

  protected setIsCursorDragging(isDragging: boolean) {
    this._isCursorDragging$.next(isDragging);
  }

  protected _scrollStateChanged(scrollState: ScrollObserverScrollState) {
    if (equal(this.scrollState$.value, scrollState)) {
      return;
    }

    this.scrollState$.next(scrollState);
    this.scrollStateChange.emit(scrollState);
  }

  protected scrollToStartDirection() {
    if (this.scrollMode === 'container') {
      this.scrollOneContainerSize('start');
    } else {
      this.scrollOneItemSize('start');
    }
  }

  protected scrollToStartEnd() {
    if (this.scrollMode === 'container') {
      this.scrollOneContainerSize('end');
    } else {
      this.scrollOneItemSize('end');
    }
  }

  private _setupScrollListening() {
    const scrollElement = this.scrollable.nativeElement;
    let isSnapping = false;
    let snapTimeout = 0;

    merge(fromEvent<WheelEvent>(scrollElement, 'wheel'), fromEvent<TouchEvent>(scrollElement, 'touchstart'))
      .pipe(
        takeUntil(this._destroy$),
        tap(() => {
          isSnapping = false;
        }),
      )
      .subscribe();

    merge(fromEvent(scrollElement, 'scroll'), this._isCursorDragging$)
      .pipe(
        debounceTime(25),
        takeUntil(this._destroy$),
        tap(() => {
          const elements =
            this.elements
              ?.toArray()
              .map((e) => e?.elementRef.nativeElement)
              .filter((e): e is HTMLElement => !!e) ?? [];

          const states = getElementVisibleStates({
            elements,
            container: scrollElement,
          });

          const prop = this.direction === 'horizontal' ? 'inlineIntersection' : 'blockIntersection';
          const stateClass = `et-element--is-intersecting`;

          for (const state of states) {
            if (state[prop] === 100) {
              state.element.classList.add(stateClass);
            } else {
              state.element.classList.remove(stateClass);
            }
          }

          this.intersectionChange.emit(
            states.map((s, i) => {
              const state: ScrollableIntersectionChange = {
                element: s.element,
                intersectionRatio: s[prop] / 100,
                isIntersecting: s[prop] === 100,
                index: i,
              };

              return state;
            }),
          );

          if (isSnapping || this._isCursorDragging$.value) return;

          const isOnlyOnePartialIntersection = states.filter((s) => s[prop] < 100 && s[prop] > 0).length === 1;

          if (isOnlyOnePartialIntersection) return;

          const highestIntersecting = states.reduce((prev, current) => {
            if (current[prop] > prev[prop] && current[prop] < 100) {
              return current;
            }

            return prev;
          });

          const fullIntersectionIndex = states.findIndex((s) => s[prop] === 100);
          const highestIntersectingIndex = states.findIndex((s) => s === highestIntersecting);

          const origin = highestIntersectingIndex > fullIntersectionIndex ? 'end' : 'start';

          if (!highestIntersecting || highestIntersecting[prop] === 100) return;

          scrollToElement({
            container: scrollElement,
            element: highestIntersecting.element,
            direction: this.direction === 'horizontal' ? 'inline' : 'block',
            origin,
            scrollBlockMargin: this.direction === 'horizontal' ? 0 : this.scrollMargin,
            scrollInlineMargin: this.direction === 'horizontal' ? this.scrollMargin : 0,
          });

          isSnapping = true;

          window.clearTimeout(snapTimeout);

          snapTimeout = window.setTimeout(() => {
            isSnapping = false;
          }, 1000);
        }),
      )
      .subscribe();
  }
}
