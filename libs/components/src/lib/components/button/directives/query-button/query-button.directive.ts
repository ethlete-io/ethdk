import { Directive, ElementRef, inject, Input } from '@angular/core';
import { createReactiveBindings, DestroyService } from '@ethlete/core';
import {
  AnyQuery,
  AnyQueryCreatorCollection,
  AnyQueryOfCreatorCollection,
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
  providers: [DestroyService],
  exportAs: 'etQueryButton',
})
export class QueryButtonDirective {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _destroy$ = inject<DestroyService>(DestroyService).destroy$;
  private readonly _button = inject(ButtonDirective);

  private _cleanupTimeout: number | null = null;

  readonly showSuccess$ = new BehaviorSubject(false);
  readonly showFailure$ = new BehaviorSubject(false);
  readonly didLoadOnce$ = new BehaviorSubject(false);
  readonly isLoading$ = new BehaviorSubject(false);

  @Input()
  get query() {
    return this._query$.value;
  }
  set query(v: AnyQuery | AnyQueryOfCreatorCollection<AnyQueryCreatorCollection> | null) {
    this._query$.next(v);

    const classList = this._elementRef.nativeElement.classList;

    if (this._cleanupTimeout !== null) {
      window.clearTimeout(this._cleanupTimeout);
    }

    classList.remove(CLASSES.success);
    classList.remove(CLASSES.failure);
    classList.remove(CLASSES.loading);

    this._bindings.reset();

    const query = extractQuery(this._query$.value);

    if (!query) {
      return;
    }

    query.state$.pipe(takeUntil(this._destroy$), takeUntil(this._query$.pipe(skip(1)))).subscribe((state) => {
      if (isQueryStateLoading(state)) {
        this.isLoading$.next(true);
        classList.add(CLASSES.loading);
      } else {
        this.isLoading$.next(false);
        classList.remove(CLASSES.loading);
      }

      if (isQueryStateSuccess(state)) {
        this.showSuccess$.next(true);
        classList.add(CLASSES.success);
      } else if (isQueryStateFailure(state)) {
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
        }, 3000);
      }
    });
  }
  get query$() {
    return this._query$.asObservable();
  }
  private readonly _query$ = new BehaviorSubject<
    AnyQuery | AnyQueryOfCreatorCollection<AnyQueryCreatorCollection> | null
  >(null);

  private readonly _bindings = createReactiveBindings(
    {
      attribute: ['disabled', 'aria-disabled'],
      observable: combineLatest([this._button.disabled$, this.showFailure$, this.showSuccess$, this.isLoading$]).pipe(
        map(([disabled, showFailure, showSuccess, isLoading]) => ({
          render: disabled || showFailure || showSuccess || isLoading,
          value: true,
        })),
      ),
    },
    {
      attribute: ['aria-live'],
      observable: combineLatest([
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

          return {
            render: true,
            value,
          };
        }),
      ),
    },
  );

  constructor() {
    this._button._removeDisabledBindings();
  }
}
