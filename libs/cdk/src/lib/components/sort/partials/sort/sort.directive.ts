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
  booleanAttribute,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable, Subject, Subscriber } from 'rxjs';
import { SortDirection } from '../../types';
import { Sort, SortDefaultOptions, Sortable } from './sort.types';

export const SORT_DEFAULT_OPTIONS = new InjectionToken<SortDefaultOptions>('SortDefaultOptions');

@Directive({
  selector: '[etSort]',
  exportAs: 'etSort',
  host: { class: 'et-sort' },
  standalone: true,
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

  @Input({ alias: 'etSortDisabled', transform: booleanAttribute })
  disabled = false;

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

  @Input({ alias: 'etSortDisableClear', transform: booleanAttribute })
  disableClear = false;

  @Input()
  sortControl?: FormControl<Sort | null>;

  @Input()
  sortByControl?: FormControl<string | null>;

  @Input()
  sortDirectionControl?: FormControl<SortDirection | null>;

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

    const sort: Sort = { active: this.active, direction: this.direction };

    this.sortChange.emit(sort);
    this.sortControl?.setValue(sort);
    this.sortByControl?.setValue(sort.active);
    this.sortDirectionControl?.setValue(sort.direction);
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

    if (this.sortControl?.value) {
      this.active = this.sortControl.value.active;
      this.direction = this.sortControl.value.direction;
    } else if (this.sortByControl?.value && this.sortDirectionControl?.value) {
      this.active = this.sortByControl.value;
      this.direction = this.sortDirectionControl.value;
    }
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
