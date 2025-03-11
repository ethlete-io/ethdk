import { AfterViewInit, Directive, effect, ElementRef, inject, InjectionToken, model, Renderer2 } from '@angular/core';
import { outputFromObservable, toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, switchMap, take, takeUntil, tap } from 'rxjs';
import { createDestroy, forceReflow, fromNextFrame } from '../../utils';
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

export type AnimatedLifecycleState = 'entering' | 'entered' | 'leaving' | 'left' | 'init';

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
  host: {
    class: 'et-force-invisible',
  },
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

  stateSignal = toSignal(this._state$, { initialValue: 'init' });

  stateChange = outputFromObservable(this._state$);

  skipNextEnter = model(false);

  constructor() {
    const renderer = inject(Renderer2);

    effect(() => {
      const state = this.stateSignal();

      if (state !== 'init') {
        renderer.removeClass(this._elementRef.nativeElement, 'et-force-invisible');
      } else {
        renderer.addClass(this._elementRef.nativeElement, 'et-force-invisible');
      }
    });
  }

  ngAfterViewInit(): void {
    this._isConstructed = true;
  }

  enter(config?: { onlyTransition?: boolean }) {
    if (this.state === 'entering') return;

    if ((this.state === 'init' && !this._isConstructed) || this.skipNextEnter()) {
      // Force the state to entered so that the element is not animated when it is first rendered.
      this._forceState('entered');
      this.skipNextEnter.set(false);
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
