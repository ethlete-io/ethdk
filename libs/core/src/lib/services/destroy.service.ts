import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * @deprecated Will be replaced with the upcoming Angular 16 `DestroyRef` feature.
 */
// TODO: Replace with Angular 16 `DestroyRef` feature when available.
@Injectable()
export class DestroyService implements OnDestroy {
  private readonly _destroy$ = new Subject<boolean>();

  readonly destroy$ = this._destroy$.asObservable();

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.unsubscribe();
  }
}
