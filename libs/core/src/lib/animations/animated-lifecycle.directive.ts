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
import { filter, Subject, switchMap, take, takeUntil, tap } from 'rxjs';
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
  private cancelCurrentAnimation$ = new Subject<void>();
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private animatable = inject(ANIMATABLE_TOKEN);
  private renderer = inject(Renderer2);
  private element = this.elementRef.nativeElement;

  private isConstructed = false;

  state = signal<AnimatedLifecycleState>('init');
  state$ = toObservable(this.state);
  stateChange = outputFromObservable(this.state$);

  skipNextEnter = model(false);

  constructor() {
    effect(() => {
      const state = this.state();
      const className = 'et-force-invisible';

      if (state !== 'init') {
        this.renderer.removeClass(this.element, className);
      } else {
        this.renderer.addClass(this.element, className);
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
      this.state.set('entered');
      this.skipNextEnter.set(false);
      this.addClass(ANIMATION_CLASSES.enterDone);
      return;
    }

    this.cancelCurrentAnimation$.next();

    if (currentState === 'leaving') {
      this.removeClasses(ANIMATION_CLASSES.leaveFrom, ANIMATION_CLASSES.leaveActive, ANIMATION_CLASSES.leaveTo);
    }

    this.state.set('entering');

    this.removeClass(ANIMATION_CLASSES.leaveDone);
    this.addClass(ANIMATION_CLASSES.enterFrom);

    forceReflow();
    this.addClass(ANIMATION_CLASSES.enterActive);

    this.startAnimationTransition({
      expectedState: 'entering',
      fromClass: ANIMATION_CLASSES.enterFrom,
      toClass: ANIMATION_CLASSES.enterTo,
      onComplete: () => {
        this.state.set('entered');
        this.removeClasses(ANIMATION_CLASSES.enterActive, ANIMATION_CLASSES.enterTo);
        this.addClass(ANIMATION_CLASSES.enterDone);
      },
    });
  }

  leave() {
    const currentState = this.state();

    if (currentState === 'leaving') return;

    if (currentState === 'init') {
      this.state.set('left');
      this.addClass(ANIMATION_CLASSES.leaveDone);
      return;
    }

    this.cancelCurrentAnimation$.next();

    if (currentState === 'entering') {
      this.removeClasses(ANIMATION_CLASSES.enterFrom, ANIMATION_CLASSES.enterActive, ANIMATION_CLASSES.enterTo);
    }

    this.state.set('leaving');

    this.removeClass(ANIMATION_CLASSES.enterDone);
    this.addClass(ANIMATION_CLASSES.leaveFrom);

    forceReflow();
    this.addClass(ANIMATION_CLASSES.leaveActive);

    this.startAnimationTransition({
      expectedState: 'leaving',
      fromClass: ANIMATION_CLASSES.leaveFrom,
      toClass: ANIMATION_CLASSES.leaveTo,
      onComplete: () => {
        this.state.set('left');
        this.removeClasses(ANIMATION_CLASSES.leaveActive, ANIMATION_CLASSES.leaveTo);
        this.addClass(ANIMATION_CLASSES.leaveDone);
      },
    });
  }

  private startAnimationTransition(config: {
    expectedState: 'entering' | 'leaving';
    fromClass: string;
    toClass: string;
    onComplete: () => void;
  }) {
    const { expectedState, fromClass, toClass, onComplete } = config;

    fromNextFrame()
      .pipe(
        tap(() => {
          if (this.state() === expectedState) {
            this.removeClass(fromClass);
            this.addClass(toClass);
          }
        }),
        switchMap(() => this.animatable.animationEnd$),
        filter(() => this.state() === expectedState),
        tap(() => onComplete()),
        take(1),
        takeUntil(this.cancelCurrentAnimation$),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  private addClass(className: string) {
    this.renderer.addClass(this.element, className);
  }

  private removeClass(className: string) {
    this.renderer.removeClass(this.element, className);
  }

  private removeClasses(...classNames: string[]) {
    for (const className of classNames) {
      this.renderer.removeClass(this.element, className);
    }
  }
}
