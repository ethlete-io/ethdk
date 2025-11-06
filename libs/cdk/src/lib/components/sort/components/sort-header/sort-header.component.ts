import { AriaDescriber, FocusMonitor } from '@angular/cdk/a11y';
import { ENTER, SPACE } from '@angular/cdk/keycodes';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  booleanAttribute,
  inject,
} from '@angular/core';
import { SortDirection } from '@ethlete/query';
import { Subscription, merge } from 'rxjs';
import { CHEVRON_ICON } from '../../../icons/chevron-icon';
import { provideIcons } from '../../../icons/icon-provider';
import { IconDirective } from '../../../icons/icon.directive';
import { SORT_HEADER_COLUMN_DEF } from '../../../table/partials/cells/column-def';
import { SORT_DEFAULT_OPTIONS, SortDirective, SortHeaderArrowPosition, Sortable } from '../../partials/sort';
import { SortHeaderIntl } from '../../services';
import { ArrowViewStateTransition } from './sort-header.types';

@Component({
  selector: '[et-sort-header]',
  exportAs: 'etSortHeader',
  templateUrl: 'sort-header.component.html',
  styleUrls: ['sort-header.component.scss'],
  host: {
    class: 'et-sort-header',
  },
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconDirective],
  providers: [provideIcons(CHEVRON_ICON)],
})
export class SortHeaderComponent implements Sortable, OnDestroy, OnInit, AfterViewInit {
  private readonly _intl = inject(SortHeaderIntl);
  private readonly _changeDetectorRef = inject(ChangeDetectorRef);
  private readonly _sort = inject(SortDirective, { optional: true });
  private readonly _columnDef = inject(SORT_HEADER_COLUMN_DEF, { optional: true });
  private readonly _focusMonitor = inject(FocusMonitor);
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _ariaDescriber = inject(AriaDescriber);
  private readonly _sortDefaultOptions = inject(SORT_DEFAULT_OPTIONS, { optional: true });

  private _rerenderSubscription?: Subscription;
  private _sortButton!: HTMLElement;

  _showIndicatorHint = false;
  _viewState: ArrowViewStateTransition = {};
  _arrowDirection: SortDirection = '';

  @Input({ transform: booleanAttribute })
  @HostBinding('class.et-sort-header-disabled')
  disabled = false;

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

  @Input({ transform: booleanAttribute })
  disableClear = false;

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

  constructor() {
    if (this._sortDefaultOptions?.arrowPosition) {
      this.arrowPosition = this._sortDefaultOptions?.arrowPosition;
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
  }

  _toggleOnInteraction() {
    this._sort?.sort(this);
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

          this._setAnimationTransitionState({ fromState: this._arrowDirection, toState: 'active' });
          this._showIndicatorHint = false;
        }

        if (!this._isSorted && this._viewState && this._viewState.toState === 'active') {
          this._setAnimationTransitionState({ fromState: 'active', toState: this._arrowDirection });
        }

        this._changeDetectorRef.markForCheck();
      },
    );
  }
}
