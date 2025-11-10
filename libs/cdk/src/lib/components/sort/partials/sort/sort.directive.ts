import {
  Directive,
  EventEmitter,
  InjectionToken,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  booleanAttribute,
  inject,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { createDestroy } from '@ethlete/core';
import { Sort, SortDirection } from '@ethlete/query';
import { Observable, Subject, Subscriber, takeUntil } from 'rxjs';
import { SortDefaultOptions, Sortable } from './sort.types';

export const SORT_DEFAULT_OPTIONS = new InjectionToken<SortDefaultOptions>('SortDefaultOptions');

@Directive({
  selector: '[etSort]',
  exportAs: 'etSort',
  host: { class: 'et-sort' },
})
export class SortDirective implements OnChanges, OnDestroy, OnInit {
  destroy$ = createDestroy();
  private readonly _defaultOptions = inject(SORT_DEFAULT_OPTIONS, { optional: true });

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
    return sortDirectionCycle[nextDirectionIndex] as SortDirection;
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

    if (this.sortControl) {
      this.sortControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value) => {
        if (value) {
          if (this.active !== value.active) {
            this.active = value.active;
          }

          if (this.direction !== value.direction) {
            this.direction = value.direction;
          }
        } else {
          this.active = undefined;
          this.direction = '';
        }

        this._stateChanges.next();
      });
    }

    if (this.sortByControl) {
      this.sortByControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value) => {
        if (value) {
          if (this.active !== value) {
            this.active = value;
          }
        } else {
          this.active = undefined;
        }

        this._stateChanges.next();
      });
    }

    if (this.sortDirectionControl) {
      this.sortDirectionControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value) => {
        if (value) {
          if (this.direction !== value) {
            this.direction = value;
          }
        } else {
          this.direction = '';
        }

        this._stateChanges.next();
      });
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
