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
        this.removeClass(className);
      } else {
        this.addClass(className);
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

    const isInterrupting = currentState === 'leaving';

    this.state.set('entering');
    this.removeClass(ANIMATION_CLASSES.leaveDone);

    if (isInterrupting) {
      this.handleInterruptedTransition({
        removeClasses: [ANIMATION_CLASSES.leaveFrom, ANIMATION_CLASSES.leaveActive, ANIMATION_CLASSES.leaveTo],
        addClasses: [ANIMATION_CLASSES.enterActive, ANIMATION_CLASSES.enterTo],
        expectedState: 'entering',
        onComplete: () => {
          this.state.set('entered');
          this.removeClasses(ANIMATION_CLASSES.enterActive, ANIMATION_CLASSES.enterTo);
          this.addClass(ANIMATION_CLASSES.enterDone);
        },
      });
    } else {
      this.handleNormalTransition({
        fromClass: ANIMATION_CLASSES.enterFrom,
        activeClass: ANIMATION_CLASSES.enterActive,
        toClass: ANIMATION_CLASSES.enterTo,
        expectedState: 'entering',
        onComplete: () => {
          this.state.set('entered');
          this.removeClasses(ANIMATION_CLASSES.enterActive, ANIMATION_CLASSES.enterTo);
          this.addClass(ANIMATION_CLASSES.enterDone);
        },
      });
    }
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

    const isInterrupting = currentState === 'entering';

    this.state.set('leaving');
    this.removeClass(ANIMATION_CLASSES.enterDone);

    if (isInterrupting) {
      this.handleInterruptedTransition({
        removeClasses: [ANIMATION_CLASSES.enterFrom, ANIMATION_CLASSES.enterActive, ANIMATION_CLASSES.enterTo],
        addClasses: [ANIMATION_CLASSES.leaveActive, ANIMATION_CLASSES.leaveTo],
        expectedState: 'leaving',
        onComplete: () => {
          this.state.set('left');
          this.removeClasses(ANIMATION_CLASSES.leaveActive, ANIMATION_CLASSES.leaveTo);
          this.addClass(ANIMATION_CLASSES.leaveDone);
        },
      });
    } else {
      this.handleNormalTransition({
        fromClass: ANIMATION_CLASSES.leaveFrom,
        activeClass: ANIMATION_CLASSES.leaveActive,
        toClass: ANIMATION_CLASSES.leaveTo,
        expectedState: 'leaving',
        onComplete: () => {
          this.state.set('left');
          this.removeClasses(ANIMATION_CLASSES.leaveActive, ANIMATION_CLASSES.leaveTo);
          this.addClass(ANIMATION_CLASSES.leaveDone);
        },
      });
    }
  }

  private handleNormalTransition(config: {
    fromClass: string;
    activeClass: string;
    toClass: string;
    expectedState: 'entering' | 'leaving';
    onComplete: () => void;
  }) {
    const { fromClass, activeClass, toClass, expectedState, onComplete } = config;

    this.addClass(fromClass);
    forceReflow();
    this.addClass(activeClass);

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

  private handleInterruptedTransition(config: {
    removeClasses: string[];
    addClasses: string[];
    expectedState: 'entering' | 'leaving';
    onComplete: () => void;
  }) {
    const { removeClasses, addClasses, expectedState, onComplete } = config;

    this.removeClasses(...removeClasses);
    addClasses.forEach((cls) => this.addClass(cls));

    this.animatable.animationEnd$
      .pipe(
        filter((e) => this.state() === expectedState && !e.cancelled),
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
