import { Directive, ElementRef, HostBinding, inject, InjectionToken } from '@angular/core';
import { BehaviorSubject, take, takeUntil, tap } from 'rxjs';
import { DestroyService } from '../../services';
import { forceReflow, nextFrame } from '../../utils';
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

  @HostBinding('style.opacity')
  private get _opacity() {
    return this._state$.value === 'init' ? '0 !important' : '';
  }

  enter(config?: { onlyTransition?: boolean }) {
    this._state$.next('entering');

    if (!config?.onlyTransition) {
      this._classList.add(ANIMATION_CLASSES.enterFrom);
    }

    forceReflow();
    this._classList.add(ANIMATION_CLASSES.enterActive);

    nextFrame(() => {
      if (!config?.onlyTransition) {
        this._classList.remove(ANIMATION_CLASSES.enterFrom);
        this._classList.add(ANIMATION_CLASSES.enterTo);
      }

      this._animatable.animationEnd$
        .pipe(
          takeUntil(this._destroy$),
          take(1),
          tap(() => {
            this._state$.next('entered');
            this._classList.remove(ANIMATION_CLASSES.enterActive);

            if (!config?.onlyTransition) {
              this._classList.remove(ANIMATION_CLASSES.enterTo);
            }
          }),
        )
        .subscribe();
    });
  }

  leave(config?: { onlyTransition?: boolean }) {
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

    nextFrame(() => {
      if (!config?.onlyTransition) {
        this._classList.remove(ANIMATION_CLASSES.leaveFrom);
        this._classList.add(ANIMATION_CLASSES.leaveTo);
      }

      this._animatable.animationEnd$
        .pipe(
          takeUntil(this._destroy$),
          take(1),
          tap(() => {
            this._state$.next('left');
            this._classList.remove(ANIMATION_CLASSES.leaveActive);

            if (!config?.onlyTransition) {
              this._classList.remove(ANIMATION_CLASSES.leaveTo);
            }
          }),
        )
        .subscribe();
    });
  }
}
