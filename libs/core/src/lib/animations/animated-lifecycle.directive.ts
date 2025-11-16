import {
  AfterViewInit,
  Directive,
  effect,
  ElementRef,
  inject,
  InjectionToken,
  model,
  Renderer2,
  signal,
} from '@angular/core';
import { outputFromObservable, toObservable } from '@angular/core/rxjs-interop';
import { filter, switchMap, take, takeUntil, tap } from 'rxjs';
import { createDestroy, forceReflow, fromNextFrame } from '../utils';
import { ANIMATABLE_TOKEN, AnimatableDirective } from './animatable.directive';

export const ANIMATED_LIFECYCLE_TOKEN = new InjectionToken<AnimatedLifecycleDirective>(
  'ANIMATED_LIFECYCLE_DIRECTIVE_TOKEN',
);

const ANIMATION_CLASSES = {
  enterFrom: 'et-animation-enter-from',
  enterActive: 'et-animation-enter-active',
  enterTo: 'et-animation-enter-to',
  enterDone: 'et-animation-enter-done',
  leaveFrom: 'et-animation-leave-from',
  leaveActive: 'et-animation-leave-active',
  leaveTo: 'et-animation-leave-to',
  leaveDone: 'et-animation-leave-done',
} as const;

export type AnimatedLifecycleState = 'entering' | 'entered' | 'leaving' | 'left' | 'init';

@Directive({
  selector: '[etAnimatedLifecycle]',
  exportAs: 'etAnimatedLifecycle',
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
  private destroy$ = createDestroy();
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private animatable = inject(ANIMATABLE_TOKEN);
  private renderer = inject(Renderer2);
  private element = this.elementRef.nativeElement;
  private classList = this.element.classList;

  private isConstructed = false;

  state = signal<AnimatedLifecycleState>('init');
  state$ = toObservable(this.state);
  stateChange = outputFromObservable(this.state$);

  skipNextEnter = model(false);

  constructor() {
    effect(() => {
      const state = this.state();

      if (state !== 'init') {
        this.renderer.removeClass(this.element, 'et-force-invisible');
      } else {
        this.renderer.addClass(this.element, 'et-force-invisible');
      }
    });
  }

  ngAfterViewInit(): void {
    this.isConstructed = true;
  }

  enter() {
    const currentState = this.state();

    if (currentState === 'entering') return;

    if ((currentState === 'init' && !this.isConstructed) || this.skipNextEnter()) {
      this._forceState('entered');
      this.skipNextEnter.set(false);
      this.classList.add(ANIMATION_CLASSES.enterDone);
      return;
    }

    if (currentState === 'leaving') {
      this.classList.remove(ANIMATION_CLASSES.leaveFrom, ANIMATION_CLASSES.leaveActive, ANIMATION_CLASSES.leaveTo);
    }

    this.state.set('entering');

    this.classList.remove(ANIMATION_CLASSES.leaveDone);
    this.classList.add(ANIMATION_CLASSES.enterFrom);

    forceReflow();
    this.classList.add(ANIMATION_CLASSES.enterActive);

    fromNextFrame()
      .pipe(
        tap(() => {
          if (this.state() === 'entering') {
            this.classList.remove(ANIMATION_CLASSES.enterFrom);
            this.classList.add(ANIMATION_CLASSES.enterTo);
          }
        }),
        switchMap(() => this.animatable.animationEnd$),
        filter(() => this.state() === 'entering'),
        tap(() => {
          this.state.set('entered');
          this.classList.remove(ANIMATION_CLASSES.enterActive, ANIMATION_CLASSES.enterTo);
          this.classList.add(ANIMATION_CLASSES.enterDone);
        }),
        take(1),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  leave() {
    const currentState = this.state();

    if (currentState === 'leaving') return;

    if (currentState === 'init') {
      this.state.set('left');
      this.classList.add(ANIMATION_CLASSES.leaveDone);
      return;
    }

    if (currentState === 'entering') {
      this.classList.remove(ANIMATION_CLASSES.enterFrom, ANIMATION_CLASSES.enterActive, ANIMATION_CLASSES.enterTo);
    }

    this.state.set('leaving');

    this.classList.remove(ANIMATION_CLASSES.enterDone);
    this.classList.add(ANIMATION_CLASSES.leaveFrom);

    forceReflow();
    this.classList.add(ANIMATION_CLASSES.leaveActive);

    fromNextFrame()
      .pipe(
        tap(() => {
          if (this.state() === 'leaving') {
            this.classList.remove(ANIMATION_CLASSES.leaveFrom);
            this.classList.add(ANIMATION_CLASSES.leaveTo);
          }
        }),
        switchMap(() => this.animatable.animationEnd$),
        filter(() => this.state() === 'leaving'),
        tap(() => {
          this.state.set('left');
          this.classList.remove(ANIMATION_CLASSES.leaveActive, ANIMATION_CLASSES.leaveTo);
          this.classList.add(ANIMATION_CLASSES.leaveDone);
        }),
        take(1),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  _forceState(state: AnimatedLifecycleState) {
    this.state.set(state);
  }
}
