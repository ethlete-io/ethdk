import { AfterViewInit, Directive, ElementRef, inject, InjectionToken } from '@angular/core';
import { BehaviorSubject, map, switchMap, take, takeUntil, tap } from 'rxjs';
import { createDestroy, createReactiveBindings, forceReflow, fromNextFrame } from '../../utils';
import { ANIMATABLE_TOKEN, AnimatableDirective } from '../animatable';

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

type AnimatedLifecycleState = 'entering' | 'entered' | 'leaving' | 'left' | 'init';

@Directive({
  selector: '[etAnimatedLifecycle]',
  exportAs: 'etAnimatedLifecycle',
  standalone: true,
  providers: [
    {
      provide: ANIMATED_LIFECYCLE_TOKEN,
      useExisting: AnimatedLifecycleDirective,
    },
  ],
  hostDirectives: [AnimatableDirective],
})
export class AnimatedLifecycleDirective implements AfterViewInit {
  private readonly _destroy$ = createDestroy();
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _animatable = inject(ANIMATABLE_TOKEN);
  private readonly _classList = this._elementRef.nativeElement.classList;

  private _isConstructed = false;

  private _state$ = new BehaviorSubject<AnimatedLifecycleState>('init');
  readonly state$ = this._state$.asObservable();

  get state() {
    return this._state$.value;
  }

  private readonly _bindings = createReactiveBindings({
    attribute: 'class.et-force-invisible',
    observable: this._state$.pipe(map((state) => state === 'init')),
    eager: true,
  });

  ngAfterViewInit(): void {
    this._isConstructed = true;
  }

  enter(config?: { onlyTransition?: boolean }) {
    if (this.state === 'entering') return;

    if (this.state === 'init' && !this._isConstructed) {
      // Force the state to entered so that the element is not animated when it is first rendered.
      this._forceState('entered');
      return;
    }

    if (this.state === 'leaving') {
      this._classList.remove(ANIMATION_CLASSES.leaveFrom);
      this._classList.remove(ANIMATION_CLASSES.leaveActive);
      this._classList.remove(ANIMATION_CLASSES.leaveTo);
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
          if (!config?.onlyTransition && this.state === 'entering') {
            this._classList.remove(ANIMATION_CLASSES.enterFrom);
            this._classList.add(ANIMATION_CLASSES.enterTo);
          }
        }),
        switchMap(() => this._animatable.animationEnd$),
        tap(() => {
          if (this.state !== 'entering') return;

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
    if (this.state === 'leaving') return;

    if (this.state === 'init') {
      this._state$.next('left');
      return;
    }

    if (this.state === 'entering') {
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
          if (!config?.onlyTransition && this.state === 'leaving') {
            this._classList.remove(ANIMATION_CLASSES.leaveFrom);
            this._classList.add(ANIMATION_CLASSES.leaveTo);
          }
        }),
        switchMap(() => this._animatable.animationEnd$),
        tap(() => {
          if (this.state !== 'leaving') return;

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

  _forceState(state: AnimatedLifecycleState) {
    this._state$.next(state);
  }
}
