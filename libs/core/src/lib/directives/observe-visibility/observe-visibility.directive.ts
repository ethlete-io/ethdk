import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  InjectionToken,
  Output,
  inject,
  signal,
} from '@angular/core';
import { takeUntil, tap } from 'rxjs';
import { IntersectionObserverService } from '../../services';
import { createDestroy } from '../../utils';

export const OBSERVE_VISIBILITY_TOKEN = new InjectionToken<ObserveVisibilityDirective>('OBSERVE_VISIBILITY_TOKEN');

export interface ObserveVisibilityChange {
  visible: boolean;
  isAbove: boolean;
  isBelow: boolean;
  isLeft: boolean;
  isRight: boolean;
  entry: IntersectionObserverEntry;
}

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
export class ObserveVisibilityDirective implements AfterViewInit {
  private readonly _destroy$ = createDestroy();
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _intersectionObserverService = inject(IntersectionObserverService);

  protected readonly isIntersecting = signal<ObserveVisibilityChange | null>(null);

  @Output()
  readonly etObserveVisibility = new EventEmitter<ObserveVisibilityChange>();

  ngAfterViewInit(): void {
    this._intersectionObserverService
      .observe(this._elementRef)
      .pipe(
        takeUntil(this._destroy$),
        tap((entries) => {
          const entry = entries[0];

          if (!entry) {
            return;
          }

          const isAbove = entry.boundingClientRect.top < 0 && entry.boundingClientRect.bottom < 0;
          const isBelow =
            entry.boundingClientRect.top > window.innerHeight && entry.boundingClientRect.bottom > window.innerHeight;
          const isLeft = entry.boundingClientRect.left < 0 && entry.boundingClientRect.right < 0;
          const isRight =
            entry.boundingClientRect.left > window.innerWidth && entry.boundingClientRect.right > window.innerWidth;

          const data: ObserveVisibilityChange = {
            visible: entry.isIntersecting,
            isAbove,
            isBelow,
            isLeft,
            isRight,
            entry,
          };

          this.etObserveVisibility.emit(data);
          this.isIntersecting.set(data);
        }),
      )
      .subscribe();
  }
}
