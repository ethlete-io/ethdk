import { Directive, ElementRef, inject, InjectionToken, OnInit } from '@angular/core';
import { BehaviorSubject, debounceTime, fromEvent, map, merge, Observable, Subject, takeUntil, tap } from 'rxjs';
import { DestroyService } from '../../services';

export const ANIMATABLE_TOKEN = new InjectionToken<AnimatableDirective>('ANIMATABLE_DIRECTIVE_TOKEN');

@Directive({
  selector: '[etAnimatable]',
  exportAs: 'etAnimatable',
  standalone: true,
  providers: [
    {
      provide: ANIMATABLE_TOKEN,
      useExisting: AnimatableDirective,
    },
    DestroyService,
  ],
})
export class AnimatableDirective implements OnInit {
  private _didEmitStart = false;

  private readonly _parent = inject(ANIMATABLE_TOKEN, { optional: true, skipSelf: true });
  private readonly _destroy$ = inject(DestroyService, { host: true }).destroy$;
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly _animationStart$ = new Subject<void>();
  private readonly _animationEnd$ = new Subject<void>();

  readonly animationStart$ = this._animationStart$.asObservable().pipe(debounceTime(0));
  readonly animationEnd$ = this._animationEnd$.asObservable().pipe(debounceTime(0));

  private readonly _hostActiveAnimationCount$ = new BehaviorSubject<number>(0);
  private readonly _totalActiveAnimationCount$ = new BehaviorSubject<number>(0);

  readonly isAnimating$: Observable<boolean> = this._totalActiveAnimationCount$.pipe(
    map((count) => count > 0),
    debounceTime(0),
  );

  ngOnInit(): void {
    merge(
      fromEvent(this._elementRef.nativeElement, 'animationstart'),
      fromEvent(this._elementRef.nativeElement, 'transitionstart'),
    )
      .pipe(
        tap(() => {
          const count = this._hostActiveAnimationCount$.value + 1;
          this._hostActiveAnimationCount$.next(count);
          this._totalActiveAnimationCount$.next(count);
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();

    merge(
      fromEvent(this._elementRef.nativeElement, 'animationend'),
      fromEvent(this._elementRef.nativeElement, 'animationcancel'),
      fromEvent(this._elementRef.nativeElement, 'transitionend'),
      fromEvent(this._elementRef.nativeElement, 'transitioncancel'),
    )
      .pipe(
        tap(() => {
          const count = this._hostActiveAnimationCount$.value - 1;
          this._hostActiveAnimationCount$.next(count);
          this._totalActiveAnimationCount$.next(count);
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();

    this._totalActiveAnimationCount$
      .pipe(
        tap((count) => {
          if (count > 0 && !this._didEmitStart) {
            this._animationStart$.next();
            this._didEmitStart = true;
          } else if (count === 0) {
            this._animationEnd$.next();
            this._didEmitStart = false;
          }
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();

    if (this._parent) {
      this._parent._hostActiveAnimationCount$
        .pipe(
          takeUntil(this._destroy$),
          tap((count) => {
            this._totalActiveAnimationCount$.next(count + this._hostActiveAnimationCount$.value);
          }),
        )
        .subscribe();
    }
  }
}
