import { BooleanInput, NumberInput, coerceBooleanProperty, coerceNumberProperty } from '@angular/cdk/coercion';
import { NgClass, NgIf } from '@angular/common';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  ElementRef,
  HostBinding,
  Input,
  OnInit,
  Renderer2,
  ViewChild,
  ViewEncapsulation,
  inject,
  isDevMode,
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
  TypedQueryList,
  createDestroy,
  equal,
  scrollToElement,
} from '@ethlete/core';
import { BehaviorSubject, startWith, takeUntil, tap } from 'rxjs';
import { ChevronIconComponent } from '../../../icons';
import { ScrollableScrollMode } from '../../types';

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

  @Input()
  get renderMasks(): boolean {
    return this._renderMasks;
  }
  set renderMasks(value: BooleanInput) {
    this._renderMasks = coerceBooleanProperty(value);
  }
  private _renderMasks = true;

  @Input()
  get renderButtons(): boolean {
    return this._renderButtons;
  }
  set renderButtons(value: BooleanInput) {
    this._renderButtons = coerceBooleanProperty(value);
  }
  private _renderButtons = true;

  @Input()
  @HostBinding('attr.render-scrollbars')
  get renderScrollbars(): boolean {
    return this._renderScrollbars;
  }
  set renderScrollbars(value: BooleanInput) {
    this._renderScrollbars = coerceBooleanProperty(value);
  }
  private _renderScrollbars = false;

  @Input()
  @HostBinding('attr.sticky-buttons')
  get stickyButtons(): boolean {
    return this._stickyButtons;
  }
  set stickyButtons(value: BooleanInput) {
    this._stickyButtons = coerceBooleanProperty(value);
  }
  private _stickyButtons = false;

  @Input()
  get cursorDragScroll(): boolean {
    return this._cursorDragScroll;
  }
  set cursorDragScroll(value: BooleanInput) {
    this._cursorDragScroll = coerceBooleanProperty(value);
  }
  private _cursorDragScroll = true;

  @Input()
  get activeElementScrollMargin(): number {
    return this._activeElementScrollMargin;
  }
  set activeElementScrollMargin(value: NumberInput) {
    this._activeElementScrollMargin = coerceNumberProperty(value);
  }
  private _activeElementScrollMargin = 40;

  @Input()
  get disableActiveElementScrolling(): boolean {
    return this._disableActiveElementScrolling;
  }
  set disableActiveElementScrolling(value: BooleanInput) {
    this._disableActiveElementScrolling = coerceBooleanProperty(value);
  }
  private _disableActiveElementScrolling = false;

  @Input()
  scrollMode: ScrollableScrollMode = 'container';

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
            scrollInlineMargin: this.direction === 'horizontal' ? this.activeElementScrollMargin : 0,
            scrollBlockMargin: this.direction === 'horizontal' ? 0 : this.activeElementScrollMargin,
          });
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  protected _scrollStateChanged(scrollState: ScrollObserverScrollState) {
    if (equal(this.scrollState$.value, scrollState)) {
      return;
    }

    this.scrollState$.next(scrollState);
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
}
