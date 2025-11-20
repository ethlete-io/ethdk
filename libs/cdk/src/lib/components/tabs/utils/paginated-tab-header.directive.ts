import { FocusableOption, FocusKeyManager } from '@angular/cdk/a11y';
import { Direction, Directionality } from '@angular/cdk/bidi';
import { ENTER, hasModifierKey, SPACE } from '@angular/cdk/keycodes';
import { ViewportRuler } from '@angular/cdk/scrolling';
import {
  AfterContentChecked,
  AfterContentInit,
  booleanAttribute,
  ChangeDetectorRef,
  Directive,
  ElementRef,
  EventEmitter,
  inject,
  input,
  Input,
  NgZone,
  numberAttribute,
  OnDestroy,
  Output,
  QueryList,
} from '@angular/core';
import { createDestroy, NgClassType, TypedQueryList } from '@ethlete/core';
import { fromEvent, merge, of as observableOf, Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ScrollableComponent, ScrollableDirection } from '../../scrollable/components/scrollable';

export type TabPaginationScrollDirection = 'after' | 'before';

const EXAGGERATED_OVERSCROLL = 60;
const HEADER_SCROLL_DELAY = 650;
const HEADER_SCROLL_INTERVAL = 100;

export type PaginatedTabHeaderItem = FocusableOption & { elementRef: ElementRef };

@Directive()
export abstract class PaginatedTabHeaderDirective implements AfterContentChecked, AfterContentInit, OnDestroy {
  protected _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  protected _cdr = inject(ChangeDetectorRef);
  private _viewportRuler = inject(ViewportRuler);
  private _dir = inject(Directionality, { optional: true });
  private _ngZone = inject(NgZone);

  abstract _items: TypedQueryList<PaginatedTabHeaderItem>;
  abstract _scrollable: ScrollableComponent;

  abstract _activeTabUnderlineManager?: { hide: () => void; alignToElement: (element: HTMLElement) => void };

  private _scrollDistance = 0;

  private _selectedIndexChanged = false;

  protected readonly _destroy$ = createDestroy();

  _tabLabelCount!: number;

  private _scrollDistanceChanged!: boolean;

  private _keyManager!: FocusKeyManager<PaginatedTabHeaderItem>;

  private _currentTextContent!: string;

  private _stopScrolling = new Subject<void>();

  @Input()
  get selectedIndex(): number {
    return this._selectedIndex;
  }
  set selectedIndex(val: unknown) {
    const value = numberAttribute(val);

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

  @Input({ transform: booleanAttribute })
  renderMasks = true;

  @Input({ transform: booleanAttribute })
  renderButtons = true;

  @Input({ transform: booleanAttribute })
  renderScrollbars = false;

  direction = input<ScrollableDirection>('horizontal');

  @Output()
  readonly selectFocusedIndex: EventEmitter<number> = new EventEmitter<number>();

  @Output()
  readonly indexFocused: EventEmitter<number> = new EventEmitter<number>();

  constructor() {
    this._ngZone.runOutsideAngular(() => {
      fromEvent(this._elementRef.nativeElement, 'mouseleave')
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

    realign();

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
      this._items.toArray()[tabIndex]?.focus();
    }
  }

  _getLayoutDirection(): Direction {
    return this._dir && this._dir.value === 'rtl' ? 'rtl' : 'ltr';
  }

  _updateTabScrollPosition() {
    this._scrollable?.scrollable()?.nativeElement.scrollTo({ left: this.scrollDistance, behavior: 'smooth' });
  }

  get scrollDistance(): number {
    return this._scrollDistance;
  }
  set scrollDistance(value: number) {
    this._scrollTo(value);
  }

  _scrollHeader(direction: TabPaginationScrollDirection) {
    const viewLength = this._scrollable?.scrollable()?.nativeElement.offsetWidth;

    if (!viewLength) return;

    const scrollAmount = ((direction == 'before' ? -1 : 1) * viewLength) / 3;

    return this._scrollTo(this._scrollDistance + scrollAmount);
  }

  _handlePaginatorClick(direction: TabPaginationScrollDirection) {
    this._stopInterval();
    this._scrollHeader(direction);
  }

  _scrollToLabel(labelIndex: number) {
    const selectedLabel = this._items ? this._items.toArray()[labelIndex] : null;
    const scrollable = this._scrollable.scrollable()?.nativeElement;

    if (!selectedLabel || !scrollable) {
      return;
    }

    const viewLength = scrollable.offsetWidth;
    const { offsetLeft, offsetWidth } = selectedLabel.elementRef.nativeElement;

    let labelBeforePos: number, labelAfterPos: number;
    if (this._getLayoutDirection() == 'ltr') {
      labelBeforePos = offsetLeft;
      labelAfterPos = labelBeforePos + offsetWidth;
    } else {
      labelAfterPos = scrollable.offsetWidth - offsetLeft;
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
    const lengthOfTabList = this._scrollable.scrollable()?.nativeElement.scrollWidth;
    const viewLength = this._scrollable.scrollable()?.nativeElement.offsetWidth;

    if (!lengthOfTabList || !viewLength) return 0;

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
        const data = this._scrollHeader(direction);

        if (!data) {
          return;
        }

        if (data.distance === 0 || data.distance >= data.maxScrollDistance) {
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
