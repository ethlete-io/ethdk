import {
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  InjectionToken,
  input,
  Signal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, filter, fromEvent, map, merge, Subject, switchMap, tap } from 'rxjs';

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
export class AnimatableDirective {
  private didEmitStart = false;

  private parent = inject(ANIMATABLE_TOKEN, { optional: true, skipSelf: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private _animationStart$ = new Subject<void>();
  private _animationEnd$ = new Subject<void>();
  private _animationCancelled$ = new Subject<void>();

  animatedElementOverride = input<HTMLElement | null | undefined>(null, { alias: 'etAnimatable' });

  animatedElement = computed(() => {
    const override = this.animatedElementOverride();

    if (override) return override;

    return this.elementRef.nativeElement;
  });

  animationStart$ = this._animationStart$.asObservable().pipe(debounceTime(0));
  animationEnd$ = this._animationEnd$.asObservable().pipe(debounceTime(0));
  animationCancelled$ = this._animationCancelled$.asObservable().pipe(debounceTime(0));

  hostActiveAnimationCount = signal(0);

  totalActiveAnimationCount: Signal<number> = computed(() => {
    const parentCount = this.parent ? this.parent.totalActiveAnimationCount() : 0;
    return parentCount + this.hostActiveAnimationCount();
  });

  isAnimating = computed(() => this.totalActiveAnimationCount() > 0);
  isAnimating$ = toObservable(this.isAnimating);

  constructor() {
    effect(() => {
      this.animatedElement();

      untracked(() => this.hostActiveAnimationCount.set(0));
    });

    effect(() => {
      const count = this.totalActiveAnimationCount();

      if (count > 0 && !this.didEmitStart) {
        this._animationStart$.next();
        this.didEmitStart = true;
      } else if (count === 0) {
        this._animationEnd$.next();
        this.didEmitStart = false;
      }
    });

    toObservable(this.animatedElement)
      .pipe(
        tap(() => {
          this.hostActiveAnimationCount.set(0);
        }),
        switchMap((el) =>
          merge(
            merge(
              fromEvent<AnimationEvent>(el, 'animationstart'),
              fromEvent<TransitionEvent>(el, 'transitionstart'),
            ).pipe(
              filter((e) => e.target === el), // skip events from children
              map(() => 'start' as const),
            ),
            merge(fromEvent<AnimationEvent>(el, 'animationend'), fromEvent<TransitionEvent>(el, 'transitionend')).pipe(
              filter((e) => e.target === el), // skip events from children
              map(() => 'end' as const),
            ),
            merge(
              fromEvent<AnimationEvent>(el, 'animationcancel'),
              fromEvent<TransitionEvent>(el, 'transitioncancel'),
            ).pipe(
              filter((e) => e.target === el), // skip events from children
              map(() => 'cancel' as const),
            ),
          ),
        ),
        tap((eventType) => {
          switch (eventType) {
            case 'start': {
              this.hostActiveAnimationCount.update((c) => c + 1);
              break;
            }
            case 'end':
            case 'cancel': {
              this.hostActiveAnimationCount.update((c) => c - 1);

              if (eventType === 'cancel') {
                this._animationCancelled$.next();
              }
              break;
            }
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
