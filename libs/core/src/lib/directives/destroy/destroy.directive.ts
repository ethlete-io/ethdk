import { Directive, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

@Directive({
  standalone: true,
})
export class DestroyDirective implements OnDestroy {
  private readonly _destroy$ = new Subject<boolean>();

  readonly destroy$ = this._destroy$.asObservable();

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.unsubscribe();
  }
}
