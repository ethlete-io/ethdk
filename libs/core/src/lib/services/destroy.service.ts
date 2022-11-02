import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'any',
})
export class DestroyService implements OnDestroy {
  private readonly _destroy$ = new Subject<boolean>();

  get destroy$() {
    return this._destroy$.asObservable();
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.unsubscribe();
  }
}
