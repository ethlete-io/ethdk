import { ElementRef, QueryList } from '@angular/core';
import { Observable, Subject, defer, fromEvent } from 'rxjs';
import { mapTo, mergeAll, mergeMap, startWith, takeUntil } from 'rxjs/operators';

export interface FocusableElement {
  _elementRef: ElementRef<HTMLElement>;
}

/**
 * @deprecated Use the new menu instead
 */
export class PointerFocusTracker<T extends FocusableElement> {
  readonly entered: Observable<T> = this._getItemPointerEntries();

  readonly exited: Observable<T> = this._getItemPointerExits();

  activeElement?: T;

  previousElement?: T;

  private readonly _destroyed: Subject<void> = new Subject();

  constructor(private readonly _items: QueryList<T>) {
    this.entered.subscribe((element) => (this.activeElement = element));
    this.exited.subscribe(() => {
      this.previousElement = this.activeElement;
      this.activeElement = undefined;
    });
  }

  destroy() {
    this._destroyed.next();
    this._destroyed.complete();
  }

  private _getItemPointerEntries(): Observable<T> {
    return defer(() =>
      this._items.changes.pipe(
        startWith(this._items),
        mergeMap((list: QueryList<T>) =>
          list.map((element) =>
            fromEvent(element._elementRef.nativeElement, 'mouseenter').pipe(
              mapTo(element),
              takeUntil(this._items.changes),
            ),
          ),
        ),
        mergeAll(),
      ),
    );
  }

  private _getItemPointerExits() {
    return defer(() =>
      this._items.changes.pipe(
        startWith(this._items),
        mergeMap((list: QueryList<T>) =>
          list.map((element) =>
            fromEvent(element._elementRef.nativeElement, 'mouseout').pipe(
              mapTo(element),
              takeUntil(this._items.changes),
            ),
          ),
        ),
        mergeAll(),
      ),
    );
  }
}
