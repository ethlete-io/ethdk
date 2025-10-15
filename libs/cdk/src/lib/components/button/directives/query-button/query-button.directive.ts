import { booleanAttribute, Directive, ElementRef, inject, Input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { createDestroy, signalHostAttributes } from '@ethlete/core';
import {
  AnyQuery,
  AnyQueryCollection,
  ExperimentalQuery,
  extractQuery,
  isQueryStateFailure,
  isQueryStateLoading,
  isQueryStateSuccess,
} from '@ethlete/query';
import { BehaviorSubject, combineLatest, map, of, skip, switchMap, takeUntil } from 'rxjs';
import { ButtonDirective } from '../button';

const CLASSES = {
  loading: 'et-query-button--loading',
  success: 'et-query-button--success',
  failure: 'et-query-button--failure',
};

@Directive({
  standalone: true,
  exportAs: 'etQueryButton',
})
export class QueryButtonDirective {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _destroy$ = createDestroy();
  private readonly _button = inject(ButtonDirective);

  private _cleanupTimeout: number | null = null;

  readonly showSuccess$ = new BehaviorSubject(false);
  readonly showFailure$ = new BehaviorSubject(false);
  readonly didLoadOnce$ = new BehaviorSubject(false);
  readonly isLoading$ = new BehaviorSubject(false);

  @Input({ transform: booleanAttribute })
  get skipSuccess(): boolean {
    return this._skipSuccess;
  }
  set skipSuccess(value: boolean) {
    this._skipSuccess = value;
  }
  private _skipSuccess = false;

  @Input({ transform: booleanAttribute })
  get skipFailure(): boolean {
    return this._skipFailure;
  }
  set skipFailure(value: boolean) {
    this._skipFailure = value;
  }
  private _skipFailure = false;

  @Input({ transform: booleanAttribute })
  get skipLoading(): boolean {
    return this._skipLoading;
  }
  set skipLoading(value: boolean) {
    this._skipLoading = value;
  }
  private _skipLoading = false;

  @Input()
  get query() {
    return this._query$.value;
  }
  set query(v: AnyQuery | ExperimentalQuery.AnyLegacyQuery | AnyQueryCollection | null) {
    this._query$.next(v);

    const classList = this._elementRef.nativeElement.classList;

    if (this._cleanupTimeout !== null) {
      window.clearTimeout(this._cleanupTimeout);
    }

    classList.remove(CLASSES.success);
    classList.remove(CLASSES.failure);
    classList.remove(CLASSES.loading);

    const query = extractQuery(this._query$.value);

    if (!query) {
      return;
    }

    // If the query is already in a success or failure state, skip it.
    // This usually happens when the button just got rendered and the query is already in a success or failure state.
    // In that case we don't want the button to flash the success or failure state.
    const skipFirst = isQueryStateSuccess(query.rawState) || isQueryStateFailure(query.rawState);

    query.state$
      .pipe(takeUntil(this._destroy$), takeUntil(this._query$.pipe(skip(1))), skip(skipFirst ? 1 : 0))
      .subscribe((state) => {
        if (isQueryStateLoading(state) && !this._skipLoading) {
          this.isLoading$.next(true);
          classList.add(CLASSES.loading);
        } else {
          this.isLoading$.next(false);
          classList.remove(CLASSES.loading);
        }

        if (isQueryStateSuccess(state) && !this._skipSuccess) {
          this.showSuccess$.next(true);
          classList.add(CLASSES.success);
        } else if (isQueryStateFailure(state) && !this._skipFailure) {
          this.showFailure$.next(true);
          classList.add(CLASSES.failure);
        }

        if (isQueryStateSuccess(state) || isQueryStateFailure(state)) {
          if (!this.didLoadOnce$.value) {
            this.didLoadOnce$.next(true);
          }

          this._cleanupTimeout = window.setTimeout(() => {
            this.showFailure$.next(false);
            this.showSuccess$.next(false);
            classList.remove(CLASSES.success);
            classList.remove(CLASSES.failure);
          }, 1000);
        }
      });
  }
  get query$() {
    return this._query$.asObservable();
  }
  private readonly _query$ = new BehaviorSubject<
    AnyQuery | ExperimentalQuery.AnyLegacyQuery | AnyQueryCollection | null
  >(null);

  readonly hostAttributeBindings = signalHostAttributes({
    'disabled aria-disabled': toSignal(
      combineLatest([this._button.disabled$, this.showFailure$, this.showSuccess$, this.isLoading$]).pipe(
        map(([disabled, showFailure, showSuccess, isLoading]) => disabled || showFailure || showSuccess || isLoading),
      ),
    ),
    'aria-live': toSignal(
      combineLatest([
        this.query$.pipe(
          map((q) => extractQuery(q)),
          switchMap((q) => q?.state$ ?? of(null)),
        ),
        this.didLoadOnce$,
      ]).pipe(
        map(([state, didLoadOnce]) => {
          let value = 'off';

          if (isQueryStateLoading(state) || isQueryStateSuccess(state) || isQueryStateFailure(state) || didLoadOnce) {
            value = 'assertive';
          }

          return value;
        }),
      ),
    ),
  });

  constructor() {
    this._button._removeDisabledBindings();
  }
}
