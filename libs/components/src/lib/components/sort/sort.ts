import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  Directive,
  EventEmitter,
  Inject,
  InjectionToken,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Optional,
  Output,
} from '@angular/core';
import { Observable, Subject, Subscriber } from 'rxjs';
import { SortDirection } from './sort-direction';

export type SortHeaderArrowPosition = 'before' | 'after';

export interface Sortable {
  id: string;
  start: SortDirection;
  disableClear: boolean;
}

export interface Sort {
  active: string;
  direction: SortDirection;
}

export interface SortDefaultOptions {
  disableClear?: boolean;
  arrowPosition?: SortHeaderArrowPosition;
}

export const SORT_DEFAULT_OPTIONS = new InjectionToken<SortDefaultOptions>('SortDefaultOptions');

@Directive({
  selector: '[etSort]',
  exportAs: 'etSort',
  host: { class: 'et-sort' },
})
export class SortDirective implements OnChanges, OnDestroy, OnInit {
  sortables = new Map<string, Sortable>();

  readonly _stateChanges = new Subject<void>();

  _isInitialized = false;

  _pendingSubscribers: Subscriber<void>[] | null = [];

  initialized = new Observable<void>((subscriber) => {
    if (this._isInitialized) {
      this._notifySubscriber(subscriber);
    } else {
      this._pendingSubscribers?.push(subscriber);
    }
  });

  @Input('etSortDisabled')
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: BooleanInput) {
    this._disabled = coerceBooleanProperty(value);
  }
  private _disabled = false;

  @Input('etSortActive')
  active?: string;

  @Input('etSortStart')
  start: SortDirection = 'asc';

  @Input('etSortDirection')
  get direction(): SortDirection {
    return this._direction;
  }
  set direction(direction: SortDirection) {
    this._direction = direction;
  }
  private _direction: SortDirection = '';

  @Input('etSortDisableClear')
  get disableClear(): boolean {
    return this._disableClear;
  }
  set disableClear(v: BooleanInput) {
    this._disableClear = coerceBooleanProperty(v);
  }
  private _disableClear = false;

  // eslint-disable-next-line @angular-eslint/no-output-rename
  @Output('etSortChange')
  readonly sortChange: EventEmitter<Sort> = new EventEmitter<Sort>();

  constructor(
    @Optional()
    @Inject(SORT_DEFAULT_OPTIONS)
    private _defaultOptions?: SortDefaultOptions,
  ) {}

  register(sortable: Sortable): void {
    this.sortables.set(sortable.id, sortable);
  }

  deregister(sortable: Sortable): void {
    this.sortables.delete(sortable.id);
  }

  sort(sortable: Sortable): void {
    if (this.active != sortable.id) {
      this.active = sortable.id;
      this.direction = sortable.start ? sortable.start : this.start;
    } else {
      this.direction = this.getNextSortDirection(sortable);
    }

    this.sortChange.emit({ active: this.active, direction: this.direction });
  }

  getNextSortDirection(sortable: Sortable): SortDirection {
    if (!sortable) {
      return '';
    }

    const disableClear = sortable?.disableClear ?? this.disableClear ?? !!this._defaultOptions?.disableClear;
    const sortDirectionCycle = getSortDirectionCycle(sortable.start || this.start, disableClear);

    let nextDirectionIndex = sortDirectionCycle.indexOf(this.direction) + 1;
    if (nextDirectionIndex >= sortDirectionCycle.length) {
      nextDirectionIndex = 0;
    }
    return sortDirectionCycle[nextDirectionIndex];
  }

  ngOnInit() {
    this._markInitialized();
  }

  ngOnChanges() {
    this._stateChanges.next();
  }

  ngOnDestroy() {
    this._stateChanges.complete();
  }

  _markInitialized(): void {
    this._isInitialized = true;

    this._pendingSubscribers?.forEach(this._notifySubscriber);
    this._pendingSubscribers = null;
  }

  _notifySubscriber(subscriber: Subscriber<void>): void {
    subscriber.next();
    subscriber.complete();
  }
}

/** Returns the sort direction cycle to use given the provided parameters of order and clear. */
function getSortDirectionCycle(start: SortDirection, disableClear: boolean): SortDirection[] {
  const sortOrder: SortDirection[] = ['asc', 'desc'];
  if (start == 'desc') {
    sortOrder.reverse();
  }
  if (!disableClear) {
    sortOrder.push('');
  }

  return sortOrder;
}
