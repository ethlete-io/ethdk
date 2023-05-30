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
} from '@angular/core';
import {
  CursorDragScrollDirective,
  IS_ACTIVE_ELEMENT,
  IsActiveElementDirective,
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

  @ViewChild('scrollable', { static: true })
  scrollable!: ElementRef<HTMLElement>;

  @ContentChildren(IS_ACTIVE_ELEMENT, { descendants: true })
  activeElements: TypedQueryList<IsActiveElementDirective> | null = null;

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
    if (!this.activeElements) {
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

  protected scrollOneContainerSizeToStart() {
    this.scrollOneContainerSize('start');
  }

  protected scrollOneContainerSizeToEnd() {
    this.scrollOneContainerSize('end');
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
}
