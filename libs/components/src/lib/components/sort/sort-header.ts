import { AriaDescriber, FocusMonitor } from '@angular/cdk/a11y';
import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { ENTER, SPACE } from '@angular/cdk/keycodes';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Optional,
  ViewEncapsulation,
} from '@angular/core';
import { merge, Subscription } from 'rxjs';
import { SORT_HEADER_COLUMN_DEF } from '../table';
import { SORT_DEFAULT_OPTIONS, SortDirective, Sortable, SortDefaultOptions, SortHeaderArrowPosition } from './sort';
import { sortAnimations } from './sort-animations';
import { SortDirection } from './sort-direction';
import { SortHeaderIntl } from './sort-header-intl';

export type ArrowViewState = SortDirection | 'hint' | 'active';

export interface ArrowViewStateTransition {
  fromState?: ArrowViewState;
  toState?: ArrowViewState;
}

interface SortHeaderColumnDef {
  name: string;
}

@Component({
  selector: '[et-sort-header]',
  exportAs: 'etSortHeader',
  templateUrl: 'sort-header.html',
  styleUrls: ['sort-header.scss'],
  host: {
    class: 'et-sort-header',
  },
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    sortAnimations.indicator,
    sortAnimations.leftPointer,
    sortAnimations.rightPointer,
    sortAnimations.arrowOpacity,
    sortAnimations.arrowPosition,
    sortAnimations.allowChildren,
  ],
})
export class SortHeaderComponent implements Sortable, OnDestroy, OnInit, AfterViewInit {
  private _rerenderSubscription?: Subscription;
  private _sortButton!: HTMLElement;

  _showIndicatorHint = false;
  _viewState: ArrowViewStateTransition = {};
  _arrowDirection: SortDirection = '';
  _disableViewStateAnimation = false;

  @Input()
  @HostBinding('class.et-sort-header-disabled')
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: BooleanInput) {
    this._disabled = coerceBooleanProperty(value);
  }
  private _disabled = false;

  @Input('et-sort-header')
  id!: string;

  @Input()
  arrowPosition: SortHeaderArrowPosition = 'after';

  @Input()
  start!: SortDirection;

  @Input()
  get sortActionDescription(): string {
    return this._sortActionDescription;
  }
  set sortActionDescription(value: string) {
    this._updateSortActionDescription(value);
  }
  private _sortActionDescription = 'Sort';

  @Input()
  get disableClear(): boolean {
    return this._disableClear;
  }
  set disableClear(v: BooleanInput) {
    this._disableClear = coerceBooleanProperty(v);
  }
  private _disableClear = false;

  get _isSorted() {
    if (!this._sort) {
      return false;
    }

    return this._sort.active == this.id && (this._sort.direction === 'asc' || this._sort.direction === 'desc');
  }

  get _getArrowDirectionState() {
    return `${this._isSorted ? 'active-' : ''}${this._arrowDirection}`;
  }

  get _getArrowViewState() {
    const fromState = this._viewState.fromState;
    return (fromState ? `${fromState}-to-` : '') + this._viewState.toState;
  }

  get _isDisabled() {
    return this._sort?.disabled || this.disabled;
  }

  get _renderArrow() {
    return !this._isDisabled || this._isSorted;
  }

  @HostBinding('attr.aria-sort')
  get _ariaSortAttr() {
    if (!this._isSorted) {
      return 'none';
    }

    return this._sort?.direction == 'asc' ? 'ascending' : 'descending';
  }

  constructor(
    public _intl: SortHeaderIntl,
    private _changeDetectorRef: ChangeDetectorRef,
    @Optional() public _sort: SortDirective | null,
    @Inject(SORT_HEADER_COLUMN_DEF)
    @Optional()
    public _columnDef: SortHeaderColumnDef | null,
    private _focusMonitor: FocusMonitor,
    private _elementRef: ElementRef<HTMLElement>,
    private _ariaDescriber: AriaDescriber,
    @Optional() @Inject(SORT_DEFAULT_OPTIONS) defaultOptions?: SortDefaultOptions,
  ) {
    if (defaultOptions?.arrowPosition) {
      this.arrowPosition = defaultOptions?.arrowPosition;
    }

    this._handleStateChanges();
  }

  ngOnInit() {
    if (!this.id && this._columnDef) {
      this.id = this._columnDef.name;
    }

    this._updateArrowDirection();
    this._setAnimationTransitionState({
      toState: this._isSorted ? 'active' : this._arrowDirection,
    });

    this._sort?.register(this);

    this._sortButton = this._elementRef.nativeElement.querySelector('.et-sort-header-container') as HTMLElement;
    this._updateSortActionDescription(this._sortActionDescription);
  }

  ngAfterViewInit() {
    this._focusMonitor.monitor(this._elementRef, true).subscribe((origin) => {
      const newState = !!origin;
      if (newState !== this._showIndicatorHint) {
        this._setIndicatorHintVisible(newState);
        this._changeDetectorRef.markForCheck();
      }
    });
  }

  ngOnDestroy() {
    this._focusMonitor.stopMonitoring(this._elementRef);
    this._sort?.deregister(this);
    this._rerenderSubscription?.unsubscribe();
  }

  @HostListener('mouseenter')
  _handleMouseEnter() {
    this._setIndicatorHintVisible(true);
  }

  @HostListener('mouseleave')
  _handleMouseLeave() {
    this._setIndicatorHintVisible(false);
  }

  _setIndicatorHintVisible(visible: boolean) {
    if (this._isDisabled && visible) {
      return;
    }

    this._showIndicatorHint = visible;

    if (!this._isSorted) {
      this._updateArrowDirection();
      if (this._showIndicatorHint) {
        this._setAnimationTransitionState({ fromState: this._arrowDirection, toState: 'hint' });
      } else {
        this._setAnimationTransitionState({ fromState: 'hint', toState: this._arrowDirection });
      }
    }
  }

  _setAnimationTransitionState(viewState: ArrowViewStateTransition) {
    this._viewState = viewState || {};

    if (this._disableViewStateAnimation) {
      this._viewState = { toState: viewState.toState };
    }
  }

  _toggleOnInteraction() {
    this._sort?.sort(this);

    if (this._viewState.toState === 'hint' || this._viewState.toState === 'active') {
      this._disableViewStateAnimation = true;
    }
  }

  @HostListener('click')
  _handleClick() {
    if (!this._isDisabled) {
      this._sort?.sort(this);
    }
  }

  @HostListener('keydown', ['$event'])
  _handleKeydown(event: KeyboardEvent) {
    if (!this._isDisabled && (event.keyCode === SPACE || event.keyCode === ENTER)) {
      event.preventDefault();
      this._toggleOnInteraction();
    }
  }

  _updateArrowDirection() {
    if (!this._sort) {
      return;
    }

    this._arrowDirection = this._isSorted ? this._sort.direction : this.start || this._sort.start;
  }

  private _updateSortActionDescription(newDescription: string) {
    if (this._sortButton) {
      this._ariaDescriber?.removeDescription(this._sortButton, this._sortActionDescription);
      this._ariaDescriber?.describe(this._sortButton, newDescription);
    }

    this._sortActionDescription = newDescription;
  }

  private _handleStateChanges() {
    if (!this._sort) {
      return;
    }

    this._rerenderSubscription = merge(this._sort.sortChange, this._sort._stateChanges, this._intl.changes).subscribe(
      () => {
        if (this._isSorted) {
          this._updateArrowDirection();

          if (this._viewState.toState === 'hint' || this._viewState.toState === 'active') {
            this._disableViewStateAnimation = true;
          }

          this._setAnimationTransitionState({ fromState: this._arrowDirection, toState: 'active' });
          this._showIndicatorHint = false;
        }

        if (!this._isSorted && this._viewState && this._viewState.toState === 'active') {
          this._disableViewStateAnimation = false;
          this._setAnimationTransitionState({ fromState: 'active', toState: this._arrowDirection });
        }

        this._changeDetectorRef.markForCheck();
      },
    );
  }
}
