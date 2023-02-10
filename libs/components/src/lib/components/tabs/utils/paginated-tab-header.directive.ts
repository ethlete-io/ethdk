import { FocusableOption, FocusKeyManager } from '@angular/cdk/a11y';
import { Direction, Directionality } from '@angular/cdk/bidi';
import { BooleanInput, coerceBooleanProperty, coerceNumberProperty, NumberInput } from '@angular/cdk/coercion';
import { ENTER, hasModifierKey, SPACE } from '@angular/cdk/keycodes';
import { ViewportRuler } from '@angular/cdk/scrolling';
import {
  AfterContentChecked,
  AfterContentInit,
  ChangeDetectorRef,
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Optional,
  Output,
  QueryList,
} from '@angular/core';
import { NgClassType, TypedQueryList } from '@ethlete/core';
import { fromEvent, merge, of as observableOf, Subject, timer } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { ScrollableComponent } from '../../scrollable';

export type TabPaginationScrollDirection = 'after' | 'before';

const EXAGGERATED_OVERSCROLL = 60;
const HEADER_SCROLL_DELAY = 650;
const HEADER_SCROLL_INTERVAL = 100;

export type PaginatedTabHeaderItem = FocusableOption & { elementRef: ElementRef };

@Directive()
export abstract class PaginatedTabHeaderDirective implements AfterContentChecked, AfterContentInit, OnDestroy {
  abstract _items: TypedQueryList<PaginatedTabHeaderItem>;
  abstract _scrollable: ScrollableComponent;

  abstract _activeTabUnderlineManager?: { hide: () => void; alignToElement: (element: HTMLElement) => void };

  private _scrollDistance = 0;

  private _selectedIndexChanged = false;

  protected readonly _destroy$ = new Subject<void>();

  _tabLabelCount!: number;

  private _scrollDistanceChanged!: boolean;

  private _keyManager!: FocusKeyManager<PaginatedTabHeaderItem>;

  private _currentTextContent!: string;

  private _stopScrolling = new Subject<void>();

  @Input()
  get selectedIndex(): number {
    return this._selectedIndex;
  }
  set selectedIndex(value: NumberInput) {
    value = coerceNumberProperty(value);

    if (this._selectedIndex != value) {
      this._selectedIndexChanged = true;
      this._selectedIndex = value;

      if (this._keyManager) {
        this._keyManager.updateActiveItem(value);
      }
    }
  }
  private _selectedIndex = 0;

  @Input()
  itemSize: 'auto' | 'same' = 'auto';

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
  get renderScrollbars(): boolean {
    return this._renderScrollbars;
  }
  set renderScrollbars(value: BooleanInput) {
    this._renderScrollbars = coerceBooleanProperty(value);
  }
  private _renderScrollbars = false;

  @Output()
  readonly selectFocusedIndex: EventEmitter<number> = new EventEmitter<number>();

  @Output()
  readonly indexFocused: EventEmitter<number> = new EventEmitter<number>();

  constructor(
    protected _elementRef: ElementRef<HTMLElement>,
    protected _cdr: ChangeDetectorRef,
    private _viewportRuler: ViewportRuler,
    @Optional() private _dir: Directionality,
    private _ngZone: NgZone,
  ) {
    _ngZone.runOutsideAngular(() => {
      fromEvent(_elementRef.nativeElement, 'mouseleave')
        .pipe(takeUntil(this._destroy$))
        .subscribe(() => {
          this._stopInterval();
        });
    });
  }

  protected abstract _itemSelected(event: KeyboardEvent): void;

  ngAfterContentInit() {
    const dirChange = this._dir ? this._dir.change : observableOf('ltr');
    const resize = this._viewportRuler.change(150);
    const realign = () => {
      this.updatePagination();
      this._alignInkBarToSelectedTab();
    };

    this._keyManager = new FocusKeyManager<PaginatedTabHeaderItem>(this._items as QueryList<PaginatedTabHeaderItem>)
      .withHorizontalOrientation(this._getLayoutDirection())
      .withHomeAndEnd()
      .withWrap();

    this._keyManager.updateActiveItem(this._selectedIndex);

    this._ngZone.onStable.pipe(take(1)).subscribe(realign);

    merge(dirChange, resize, this._items.changes)
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        this._ngZone.run(() => {
          Promise.resolve().then(() => {
            this._scrollDistance = Math.max(0, Math.min(this._getMaxScrollDistance(), this._scrollDistance));
            realign();
          });
        });
        this._keyManager.withHorizontalOrientation(this._getLayoutDirection());
      });

    this._keyManager.change.pipe(takeUntil(this._destroy$)).subscribe((newFocusIndex) => {
      this.indexFocused.emit(newFocusIndex);
      this._setTabFocus(newFocusIndex);
    });
  }

  ngAfterContentChecked(): void {
    if (this._tabLabelCount !== this._items.length) {
      this.updatePagination();
      this._tabLabelCount = this._items.length;
      this._cdr.markForCheck();
    }

    if (this._selectedIndexChanged) {
      this._scrollToLabel(this._selectedIndex);
      this._alignInkBarToSelectedTab();
      this._selectedIndexChanged = false;
      this._cdr.markForCheck();
    }

    if (this._scrollDistanceChanged) {
      this._updateTabScrollPosition();
      this._scrollDistanceChanged = false;
      this._cdr.markForCheck();
    }
  }

  ngOnDestroy() {
    this._destroy$.next();
    this._destroy$.complete();
    this._stopScrolling.complete();
  }

  _handleKeydown(event: KeyboardEvent) {
    if (hasModifierKey(event)) {
      return;
    }

    switch (event.keyCode) {
      case ENTER:
      case SPACE:
        if (this.focusIndex !== this.selectedIndex) {
          this.selectFocusedIndex.emit(this.focusIndex);
          this._itemSelected(event);
        }
        break;
      default:
        this._keyManager.onKeydown(event);
    }
  }

  _onContentChanges() {
    const textContent = this._elementRef.nativeElement.textContent;

    if (textContent !== this._currentTextContent) {
      this._currentTextContent = textContent || '';

      this._ngZone.run(() => {
        this.updatePagination();
        this._alignInkBarToSelectedTab();
        this._cdr.markForCheck();
      });
    }
  }

  updatePagination() {
    this._updateTabScrollPosition();
  }

  get focusIndex(): number {
    return this._keyManager.activeItemIndex ?? 0;
  }

  set focusIndex(value: number) {
    if (!this._isValidIndex(value) || this.focusIndex === value || !this._keyManager) {
      return;
    }

    this._keyManager.setActiveItem(value);
  }

  _isValidIndex(index: number): boolean {
    if (!this._items) {
      return true;
    }

    const tab = this._items ? this._items.toArray()[index] : null;
    return !!tab && !tab.disabled;
  }

  _setTabFocus(tabIndex: number) {
    this._scrollToLabel(tabIndex);

    if (this._items && this._items.length) {
      this._items.toArray()[tabIndex].focus();
    }
  }

  _getLayoutDirection(): Direction {
    return this._dir && this._dir.value === 'rtl' ? 'rtl' : 'ltr';
  }

  _updateTabScrollPosition() {
    this._scrollable?.scrollable.nativeElement.scrollTo({ left: this.scrollDistance, behavior: 'smooth' });
  }

  get scrollDistance(): number {
    return this._scrollDistance;
  }
  set scrollDistance(value: number) {
    this._scrollTo(value);
  }

  _scrollHeader(direction: TabPaginationScrollDirection) {
    const viewLength = this._scrollable?.scrollable.nativeElement.offsetWidth;

    const scrollAmount = ((direction == 'before' ? -1 : 1) * viewLength) / 3;

    return this._scrollTo(this._scrollDistance + scrollAmount);
  }

  _handlePaginatorClick(direction: TabPaginationScrollDirection) {
    this._stopInterval();
    this._scrollHeader(direction);
  }

  _scrollToLabel(labelIndex: number) {
    const selectedLabel = this._items ? this._items.toArray()[labelIndex] : null;

    if (!selectedLabel) {
      return;
    }

    const viewLength = this._scrollable.scrollable.nativeElement.offsetWidth;
    const { offsetLeft, offsetWidth } = selectedLabel.elementRef.nativeElement;

    let labelBeforePos: number, labelAfterPos: number;
    if (this._getLayoutDirection() == 'ltr') {
      labelBeforePos = offsetLeft;
      labelAfterPos = labelBeforePos + offsetWidth;
    } else {
      labelAfterPos = this._scrollable.scrollable.nativeElement.offsetWidth - offsetLeft;
      labelBeforePos = labelAfterPos - offsetWidth;
    }

    const beforeVisiblePos = this.scrollDistance;
    const afterVisiblePos = this.scrollDistance + viewLength;

    if (labelBeforePos < beforeVisiblePos) {
      this.scrollDistance -= beforeVisiblePos - labelBeforePos + EXAGGERATED_OVERSCROLL;
    } else if (labelAfterPos > afterVisiblePos) {
      this.scrollDistance += labelAfterPos - afterVisiblePos + EXAGGERATED_OVERSCROLL;
    }
  }

  _getMaxScrollDistance(): number {
    const lengthOfTabList = this._scrollable.scrollable.nativeElement.scrollWidth;
    const viewLength = this._scrollable.scrollable.nativeElement.offsetWidth;
    return lengthOfTabList - viewLength || 0;
  }

  _alignInkBarToSelectedTab(): void {
    const selectedItem = this._items && this._items.length ? this._items.toArray()[this.selectedIndex] : null;
    const selectedLabelWrapper = selectedItem ? selectedItem.elementRef.nativeElement : null;

    if (selectedLabelWrapper) {
      this._activeTabUnderlineManager?.alignToElement(selectedLabelWrapper);
    } else {
      this._activeTabUnderlineManager?.hide();
    }
  }

  _stopInterval() {
    this._stopScrolling.next();
  }

  _handlePaginatorPress(direction: TabPaginationScrollDirection, mouseEvent?: MouseEvent) {
    if (mouseEvent && mouseEvent.button != null && mouseEvent.button !== 0) {
      return;
    }

    this._stopInterval();

    timer(HEADER_SCROLL_DELAY, HEADER_SCROLL_INTERVAL)
      .pipe(takeUntil(merge(this._stopScrolling, this._destroy$)))
      .subscribe(() => {
        const { maxScrollDistance, distance } = this._scrollHeader(direction);

        if (distance === 0 || distance >= maxScrollDistance) {
          this._stopInterval();
        }
      });
  }

  private _scrollTo(position: number) {
    const maxScrollDistance = this._getMaxScrollDistance();
    this._scrollDistance = Math.max(0, Math.min(maxScrollDistance, position));

    this._scrollDistanceChanged = true;

    return { maxScrollDistance, distance: this._scrollDistance };
  }
}
