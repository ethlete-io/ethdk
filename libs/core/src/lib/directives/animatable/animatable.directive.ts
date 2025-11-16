import { Directive, ElementRef, inject, InjectionToken, Input, isDevMode, OnInit } from '@angular/core';
import {
  BehaviorSubject,
  debounceTime,
  filter,
  fromEvent,
  map,
  merge,
  Observable,
  skip,
  Subject,
  takeUntil,
  tap,
} from 'rxjs';
import { createDestroy } from '../../utils';

export const ANIMATABLE_TOKEN = new InjectionToken<AnimatableDirective>('ANIMATABLE_DIRECTIVE_TOKEN');

@Directive({
  selector: '[etAnimatable]',
  exportAs: 'etAnimatable',

  providers: [
    {
      provide: ANIMATABLE_TOKEN,
      useExisting: AnimatableDirective,
    },
  ],
})
export class AnimatableDirective implements OnInit {
  private _didEmitStart = false;

  private readonly _parent = inject(ANIMATABLE_TOKEN, { optional: true, skipSelf: true });
  private readonly _destroy$ = createDestroy();
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly _animationStart$ = new Subject<void>();
  private readonly _animationEnd$ = new Subject<void>();
  private readonly _animationCancelled$ = new Subject<void>();

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input('etAnimatable')
  set animatedElement(value: string | HTMLElement | null | undefined) {
    let newElement: HTMLElement | null = null;
    if (value === null || value === undefined || value === '') {
      newElement = this._elementRef.nativeElement;
    } else if (typeof value === 'string') {
      const el = document.querySelector(value) as HTMLElement;

      if (el) {
        newElement = el;
      } else {
        if (isDevMode()) {
          console.warn(`Element with selector ${value} not found. Animatable directive will use host element.`);
        }

        newElement = this._elementRef.nativeElement;
      }
    } else {
      newElement = value;
    }

    if (this._animatedElement$.value !== newElement) {
      this._animatedElement$.next(newElement);
    }
  }
  private _animatedElement$ = new BehaviorSubject<HTMLElement>(this._elementRef.nativeElement);

  readonly animationStart$ = this._animationStart$.asObservable().pipe(debounceTime(0));
  readonly animationEnd$ = this._animationEnd$.asObservable().pipe(debounceTime(0));
  readonly animationCancelled$ = this._animationCancelled$.asObservable().pipe(debounceTime(0));

  private readonly _hostActiveAnimationCount$ = new BehaviorSubject<number>(0);
  private readonly _totalActiveAnimationCount$ = new BehaviorSubject<number>(0);

  readonly isAnimating$: Observable<boolean> = this._totalActiveAnimationCount$.pipe(
    map((count) => count > 0),
    debounceTime(0),
  );

  ngOnInit(): void {
    this._animatedElement$
      .pipe(
        tap((el) => {
          this._totalActiveAnimationCount$.next(
            this._totalActiveAnimationCount$.value - this._hostActiveAnimationCount$.value,
          );
          this._hostActiveAnimationCount$.next(0);

          merge(fromEvent<AnimationEvent>(el, 'animationstart'), fromEvent<TransitionEvent>(el, 'transitionstart'))
            .pipe(
              filter((e) => e.target === el), // skip events from children
              tap(() => {
                const count = this._hostActiveAnimationCount$.value + 1;
                this._hostActiveAnimationCount$.next(count);
                this._totalActiveAnimationCount$.next(count);
              }),
              takeUntil(this._destroy$),
              takeUntil(this._animatedElement$.pipe(skip(1))),
            )
            .subscribe();

          merge(
            fromEvent<AnimationEvent>(el, 'animationend'),
            fromEvent<AnimationEvent>(el, 'animationcancel'),
            fromEvent<TransitionEvent>(el, 'transitionend'),
            fromEvent<TransitionEvent>(el, 'transitioncancel'),
          )
            .pipe(
              filter((e) => e.target === el), // skip events from children
              tap(() => {
                const count = this._hostActiveAnimationCount$.value - 1;
                this._hostActiveAnimationCount$.next(count);
                this._totalActiveAnimationCount$.next(count);
              }),
              takeUntil(this._destroy$),
              takeUntil(this._animatedElement$.pipe(skip(1))),
            )
            .subscribe();

          merge(fromEvent<AnimationEvent>(el, 'animationcancel'), fromEvent<TransitionEvent>(el, 'transitioncancel'))
            .pipe(
              filter((e) => e.target === el), // skip events from children
              tap(() => {
                this._animationCancelled$.next();
              }),
              takeUntil(this._destroy$),
              takeUntil(this._animatedElement$.pipe(skip(1))),
            )
            .subscribe();
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
