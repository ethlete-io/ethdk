import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  InjectionToken,
  Output,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { takeUntil, tap } from 'rxjs';
import { IntersectionObserverService } from '../../services';
import { signalHostClasses } from '../../signals';
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

export const signalVisibilityChangeClasses = (cfg: {
  name: string;
  signal: Signal<ObserveVisibilityChange | null | undefined>;
}) => ({
  [`${cfg.name}--is-left`]: computed(() => cfg.signal()?.isLeft),
  [`${cfg.name}--is-right`]: computed(() => cfg.signal()?.isRight),
  [`${cfg.name}--is-above`]: computed(() => cfg.signal()?.isAbove),
  [`${cfg.name}--is-below`]: computed(() => cfg.signal()?.isBelow),
  [`${cfg.name}--is-visible`]: computed(() => cfg.signal()?.visible),
});

@Directive({
  selector: '[etObserveVisibility]',
  providers: [
    {
      provide: OBSERVE_VISIBILITY_TOKEN,
      useExisting: ObserveVisibilityDirective,
    },
  ],
  host: {
    class: 'et-observe-visibility',
  },
})
export class ObserveVisibilityDirective implements AfterViewInit {
  private readonly _destroy$ = createDestroy();
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _intersectionObserverService = inject(IntersectionObserverService);

  protected readonly visibilityChange = signal<ObserveVisibilityChange | null>(null);

  readonly currentVisibility = this.visibilityChange.asReadonly();
  readonly currentVisibility$ = toObservable(this.currentVisibility);

  @Output()
  readonly etObserveVisibility = new EventEmitter<ObserveVisibilityChange>();

  constructor() {
    signalHostClasses(
      signalVisibilityChangeClasses({
        name: 'et-observe-visibility',
        signal: this.visibilityChange,
      }),
    );
  }

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
          this.visibilityChange.set(data);
        }),
      )
      .subscribe();
  }
}
