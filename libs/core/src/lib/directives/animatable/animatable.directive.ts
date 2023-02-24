import { Directive, ElementRef, inject, InjectionToken, OnInit } from '@angular/core';
import { BehaviorSubject, debounceTime, fromEvent, merge, Observable, Subject, takeUntil, tap } from 'rxjs';
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
  private readonly _parent = inject(ANIMATABLE_TOKEN, { optional: true, skipSelf: true });
  private readonly _destroy$ = inject(DestroyService, { host: true }).destroy$;
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly _animationStart$ = new Subject<void>();
  private readonly _animationEnd$ = new Subject<void>();
  private readonly _isAnimating$ = new BehaviorSubject<boolean>(false);

  readonly animationStart$: Observable<void> = merge(
    this._parent?.animationStart$ ?? new Subject<void>(),
    this._animationStart$,
  ).pipe(debounceTime(0));

  readonly animationEnd$: Observable<void> = merge(
    this._parent?.animationEnd$ ?? new Subject<void>(),
    this._animationEnd$,
  ).pipe(debounceTime(0));

  readonly isAnimating$: Observable<boolean> = this._isAnimating$.asObservable();

  ngOnInit(): void {
    merge(
      fromEvent(this._elementRef.nativeElement, 'animationstart'),
      fromEvent(this._elementRef.nativeElement, 'transitionstart'),
    )
      .pipe(
        takeUntil(this._destroy$),
        tap(() => {
          this._isAnimating$.next(true);
          this._animationStart$.next();
        }),
      )
      .subscribe();

    merge(
      fromEvent(this._elementRef.nativeElement, 'animationend'),
      fromEvent(this._elementRef.nativeElement, 'transitionend'),
    )
      .pipe(
        takeUntil(this._destroy$),
        tap(() => {
          this._isAnimating$.next(false);
          this._animationEnd$.next();
        }),
      )
      .subscribe();
  }
}
