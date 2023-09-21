import { Directive, ElementRef, EventEmitter, InjectionToken, Output, inject, signal } from '@angular/core';
import { takeUntil, tap } from 'rxjs';
import { IntersectionObserverService } from '../../services';
import { createDestroy } from '../../utils';

export const OBSERVE_VISIBILITY_TOKEN = new InjectionToken<ObserveVisibilityDirective>('OBSERVE_VISIBILITY_TOKEN');

@Directive({
  selector: '[etObserveVisibility]',
  standalone: true,
  providers: [
    {
      provide: OBSERVE_VISIBILITY_TOKEN,
      useExisting: ObserveVisibilityDirective,
    },
  ],
  host: {
    class: 'et-observe-visibility',
    '[class.et-observe-visibility--is-visible]': 'isIntersecting',
  },
})
export class ObserveVisibilityDirective {
  private readonly _destroy$ = createDestroy();
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _intersectionObserverService = inject(IntersectionObserverService);

  protected readonly isIntersecting = signal(false);

  @Output()
  readonly etObserveVisibility = new EventEmitter<boolean>();

  constructor() {
    this._intersectionObserverService
      .observe(this._elementRef)
      .pipe(
        takeUntil(this._destroy$),
        tap((entries) => {
          const entry = entries[0];

          if (!entry) {
            return;
          }

          this.etObserveVisibility.emit(entry.isIntersecting);
          this.isIntersecting.set(entry.isIntersecting);
        }),
      )
      .subscribe();
  }
}
