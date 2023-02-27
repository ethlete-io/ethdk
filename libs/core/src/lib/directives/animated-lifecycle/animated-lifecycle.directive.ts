import { Directive, ElementRef, inject, InjectionToken, isDevMode } from '@angular/core';
import { BehaviorSubject, map, switchMap, take, takeUntil, tap } from 'rxjs';
import { DestroyService } from '../../services';
import { createReactiveBindings, forceReflow, fromNextFrame } from '../../utils';
import { AnimatableDirective, ANIMATABLE_TOKEN } from '../public-api';

export const ANIMATED_LIFECYCLE_TOKEN = new InjectionToken<AnimatedLifecycleDirective>(
  'ANIMATED_LIFECYCLE_DIRECTIVE_TOKEN',
);

const ANIMATION_CLASSES = {
  enterFrom: 'et-animation-enter-from',
  enterActive: 'et-animation-enter-active',
  enterTo: 'et-animation-enter-to',
  leaveFrom: 'et-animation-leave-from',
  leaveActive: 'et-animation-leave-active',
  leaveTo: 'et-animation-leave-to',
} as const;

@Directive({
  selector: '[etAnimatedLifecycle]',
  exportAs: 'etAnimatedLifecycle',
  standalone: true,
  providers: [
    {
      provide: ANIMATED_LIFECYCLE_TOKEN,
      useExisting: AnimatedLifecycleDirective,
    },
    DestroyService,
  ],
  hostDirectives: [AnimatableDirective],
})
export class AnimatedLifecycleDirective {
  private readonly _destroy$ = inject(DestroyService, { host: true }).destroy$;
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _animatable = inject(ANIMATABLE_TOKEN);
  private readonly _classList = this._elementRef.nativeElement.classList;

  private _state$ = new BehaviorSubject<'entering' | 'entered' | 'leaving' | 'left' | 'init'>('init');
  readonly state$ = this._state$.asObservable();

  get state() {
    return this._state$.value;
  }

  private readonly _bindings = createReactiveBindings({
    attribute: 'class.et-force-invisible',
    observable: this._state$.pipe(map((state) => state === 'init')),
  });

  enter(config?: { onlyTransition?: boolean }) {
    if (this.state !== 'init' && this.state !== 'left' && isDevMode()) {
      console.warn(
        'Tried to enter but the element is not in the initial state. This may result in unexpected behavior.',
        this,
      );
    }

    this._state$.next('entering');

    if (!config?.onlyTransition) {
      this._classList.add(ANIMATION_CLASSES.enterFrom);
    }

    forceReflow();
    this._classList.add(ANIMATION_CLASSES.enterActive);

    fromNextFrame()
      .pipe(
        tap(() => {
          if (!config?.onlyTransition) {
            this._classList.remove(ANIMATION_CLASSES.enterFrom);
            this._classList.add(ANIMATION_CLASSES.enterTo);
          }
        }),
        switchMap(() => this._animatable.animationEnd$),
        tap(() => {
          this._state$.next('entered');
          this._classList.remove(ANIMATION_CLASSES.enterActive);

          if (!config?.onlyTransition) {
            this._classList.remove(ANIMATION_CLASSES.enterTo);
          }
        }),
        takeUntil(this._destroy$),
        take(1),
      )
      .subscribe();
  }

  leave(config?: { onlyTransition?: boolean }) {
    if (this.state !== 'entered' && this.state !== 'entering' && isDevMode()) {
      console.warn('Tried to leave while already leaving or left. This may result in unexpected behavior.', this);
    }

    if (
      this._classList.contains(ANIMATION_CLASSES.enterFrom) ||
      this._classList.contains(ANIMATION_CLASSES.enterActive) ||
      this._classList.contains(ANIMATION_CLASSES.enterTo)
    ) {
      this._classList.remove(ANIMATION_CLASSES.enterFrom);
      this._classList.remove(ANIMATION_CLASSES.enterActive);
      this._classList.remove(ANIMATION_CLASSES.enterTo);
    }

    this._state$.next('leaving');

    if (!config?.onlyTransition) {
      this._classList.add(ANIMATION_CLASSES.leaveFrom);
    }

    forceReflow();
    this._classList.add(ANIMATION_CLASSES.leaveActive);

    fromNextFrame()
      .pipe(
        tap(() => {
          if (!config?.onlyTransition) {
            this._classList.remove(ANIMATION_CLASSES.leaveFrom);
            this._classList.add(ANIMATION_CLASSES.leaveTo);
          }
        }),
        switchMap(() => this._animatable.animationEnd$),
        tap(() => {
          this._state$.next('left');
          this._classList.remove(ANIMATION_CLASSES.leaveActive);

          if (!config?.onlyTransition) {
            this._classList.remove(ANIMATION_CLASSES.leaveTo);
          }
        }),
        takeUntil(this._destroy$),
        take(1),
      )
      .subscribe();
  }
}
