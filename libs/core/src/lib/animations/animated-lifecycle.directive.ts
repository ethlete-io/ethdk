import { AfterViewInit, DestroyRef, Directive, ElementRef, inject, InjectionToken, model } from '@angular/core';
import { outputFromObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, filter, map, race, Subject, switchMap, take, takeUntil, tap, timer } from 'rxjs';
import { injectRenderer } from '../providers';
import { ANIMATABLE_TOKEN, AnimatableDirective, AnimationEndEvent } from './animatable.directive';
import { forceReflow, fromNextFrame } from './animation-utils';

export const ANIMATED_LIFECYCLE_TOKEN = new InjectionToken<AnimatedLifecycleDirective>(
  'ANIMATED_LIFECYCLE_DIRECTIVE_TOKEN',
);

const ANIMATION_CLASSES = {
  enterFrom: 'et-animation-enter-from',
  enterActive: 'et-animation-enter-active',
  enterTo: 'et-animation-enter-to',
  enterDone: 'et-animation-enter-done',
  enterInterrupt: 'et-animation-enter-interrupt',
  leaveFrom: 'et-animation-leave-from',
  leaveActive: 'et-animation-leave-active',
  leaveTo: 'et-animation-leave-to',
  leaveDone: 'et-animation-leave-done',
  leaveInterrupt: 'et-animation-leave-interrupt',
} as const;

const FORCE_INVISIBLE_CLASS = 'et-force-invisible';

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
    class: FORCE_INVISIBLE_CLASS,
  },
})
export class AnimatedLifecycleDirective implements AfterViewInit {
  private destroyRef = inject(DestroyRef);
  private cancelCurrentAnimation$ = new Subject<void>();
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private animatable = inject(ANIMATABLE_TOKEN);
  private renderer = injectRenderer();
  private element = this.elementRef.nativeElement;

  private isConstructed = false;
  private transitionIdCounter = 0;

  state$ = new BehaviorSubject<AnimatedLifecycleState>('init');

  stateChange = outputFromObservable(this.state$);

  skipNextEnter = model(false);

  constructor() {
    this.state$
      .pipe(
        tap((state) => {
          if (state !== 'init') {
            this.removeClass(FORCE_INVISIBLE_CLASS);
          } else {
            this.addClass(FORCE_INVISIBLE_CLASS);
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  ngAfterViewInit(): void {
    this.isConstructed = true;
  }

  enter() {
    const currentState = this.state$.value;

    if (currentState === 'entering') return;

    if ((currentState === 'init' && !this.isConstructed) || this.skipNextEnter()) {
      this.updateState('entered');
      this.skipNextEnter.set(false);
      this.addClass(ANIMATION_CLASSES.enterDone);
      return;
    }

    const isInterrupting = currentState === 'leaving';

    this.updateState('entering');
    this.removeClass(ANIMATION_CLASSES.leaveDone);

    const previousCancel$ = this.cancelCurrentAnimation$;
    this.cancelCurrentAnimation$ = new Subject<void>();

    const transitionId = `enter-${++this.transitionIdCounter}`;
    this.animatable.setTransitionId(transitionId);

    if (isInterrupting) {
      this.handleInterruptedTransition({
        removeClasses: [
          ANIMATION_CLASSES.leaveFrom,
          ANIMATION_CLASSES.leaveActive,
          ANIMATION_CLASSES.leaveTo,
          ANIMATION_CLASSES.leaveInterrupt,
        ],
        addClasses: [ANIMATION_CLASSES.enterActive, ANIMATION_CLASSES.enterTo, ANIMATION_CLASSES.enterInterrupt],
        expectedState: 'entering',
        transitionId,
        onComplete: () => {
          this.updateState('entered');
          this.removeClasses(ANIMATION_CLASSES.enterActive, ANIMATION_CLASSES.enterTo);
          this.addClass(ANIMATION_CLASSES.enterDone);
        },
        cancelSignal: this.cancelCurrentAnimation$,
      });
    } else {
      this.handleNormalTransition({
        fromClass: ANIMATION_CLASSES.enterFrom,
        activeClass: ANIMATION_CLASSES.enterActive,
        toClass: ANIMATION_CLASSES.enterTo,
        expectedState: 'entering',
        transitionId,
        onComplete: () => {
          this.updateState('entered');
          this.removeClasses(ANIMATION_CLASSES.enterActive, ANIMATION_CLASSES.enterTo);
          this.addClass(ANIMATION_CLASSES.enterDone);
        },
        cancelSignal: this.cancelCurrentAnimation$,
      });
    }

    previousCancel$.next();
    previousCancel$.complete();
  }

  leave() {
    const currentState = this.state$.value;

    if (currentState === 'leaving') return;

    if (currentState === 'init') {
      this.updateState('left');
      this.addClass(ANIMATION_CLASSES.leaveDone);
      return;
    }

    const isInterrupting = currentState === 'entering';

    this.updateState('leaving');
    this.removeClass(ANIMATION_CLASSES.enterDone);

    const previousCancel$ = this.cancelCurrentAnimation$;
    this.cancelCurrentAnimation$ = new Subject<void>();

    const transitionId = `leave-${++this.transitionIdCounter}`;
    this.animatable.setTransitionId(transitionId);

    if (isInterrupting) {
      this.handleInterruptedTransition({
        removeClasses: [
          ANIMATION_CLASSES.enterFrom,
          ANIMATION_CLASSES.enterActive,
          ANIMATION_CLASSES.enterTo,
          ANIMATION_CLASSES.enterInterrupt,
        ],
        addClasses: [ANIMATION_CLASSES.leaveActive, ANIMATION_CLASSES.leaveTo, ANIMATION_CLASSES.leaveInterrupt],
        expectedState: 'leaving',
        transitionId,
        onComplete: () => {
          this.updateState('left');
          this.removeClasses(ANIMATION_CLASSES.leaveActive, ANIMATION_CLASSES.leaveTo);
          this.addClass(ANIMATION_CLASSES.leaveDone);
        },
        cancelSignal: this.cancelCurrentAnimation$,
      });
    } else {
      this.handleNormalTransition({
        fromClass: ANIMATION_CLASSES.leaveFrom,
        activeClass: ANIMATION_CLASSES.leaveActive,
        toClass: ANIMATION_CLASSES.leaveTo,
        expectedState: 'leaving',
        transitionId,
        onComplete: () => {
          this.updateState('left');
          this.removeClasses(ANIMATION_CLASSES.leaveActive, ANIMATION_CLASSES.leaveTo);
          this.addClass(ANIMATION_CLASSES.leaveDone);
        },
        cancelSignal: this.cancelCurrentAnimation$,
      });
    }

    previousCancel$.next();
    previousCancel$.complete();
  }

  forceEnteredState() {
    this.cancelCurrentAnimation$.next();

    this.updateState('entered');
    this.removeClasses(
      ANIMATION_CLASSES.enterFrom,
      ANIMATION_CLASSES.enterActive,
      ANIMATION_CLASSES.enterTo,
      ANIMATION_CLASSES.leaveFrom,
      ANIMATION_CLASSES.leaveActive,
      ANIMATION_CLASSES.leaveTo,
    );
    this.addClass(ANIMATION_CLASSES.enterDone);
  }

  forceLeftState() {
    this.cancelCurrentAnimation$.next();

    this.updateState('left');
    this.removeClasses(
      ANIMATION_CLASSES.enterFrom,
      ANIMATION_CLASSES.enterActive,
      ANIMATION_CLASSES.enterTo,
      ANIMATION_CLASSES.leaveFrom,
      ANIMATION_CLASSES.leaveActive,
      ANIMATION_CLASSES.leaveTo,
    );
    this.addClass(ANIMATION_CLASSES.leaveDone);
  }

  private handleNormalTransition(config: {
    fromClass: string;
    activeClass: string;
    toClass: string;
    expectedState: 'entering' | 'leaving';
    transitionId: string;
    onComplete: () => void;
    cancelSignal: Subject<void>;
  }) {
    const { fromClass, activeClass, toClass, expectedState, transitionId, onComplete, cancelSignal } = config;

    this.removeClasses(ANIMATION_CLASSES.enterInterrupt, ANIMATION_CLASSES.leaveInterrupt);

    this.addClass(fromClass);
    forceReflow();
    this.addClass(activeClass);

    fromNextFrame()
      .pipe(
        tap(() => {
          if (this.state$.value === expectedState) {
            this.removeClass(fromClass);
            this.addClass(toClass);
          }
        }),
        switchMap(() => this.animatable.animationEnd$),
        filter((e) => this.state$.value === expectedState && !e.cancelled && e.transitionId === transitionId),
        tap(onComplete),
        take(1),
        takeUntil(cancelSignal),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private handleInterruptedTransition(config: {
    removeClasses: string[];
    addClasses: string[];
    expectedState: 'entering' | 'leaving';
    transitionId: string;
    onComplete: () => void;
    cancelSignal: Subject<void>;
  }) {
    const { removeClasses, addClasses, expectedState, transitionId, onComplete, cancelSignal } = config;

    this.removeClasses(...removeClasses);
    addClasses.forEach((cls) => this.addClass(cls));

    const noAnimationTimeout$ = timer(100).pipe(
      filter(() => this.state$.value === expectedState),
      switchMap(() => this.animatable.isAnimating$),
      filter((isAnimating) => !isAnimating),
      take(1),
      map(() => ({ cancelled: false, transitionId }) as AnimationEndEvent),
    );

    race(
      this.animatable.animationEnd$.pipe(
        filter((e) => this.state$.value === expectedState && !e.cancelled && e.transitionId === transitionId),
      ),
      noAnimationTimeout$,
    )
      .pipe(tap(onComplete), take(1), takeUntil(cancelSignal), takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  private addClass(className: string) {
    this.renderer.addClass(this.element, className);
  }

  private removeClass(className: string) {
    this.renderer.removeClass(this.element, className);
  }

  private removeClasses(...classNames: string[]) {
    this.renderer.removeClass(this.element, ...classNames);
  }

  private updateState(newState: AnimatedLifecycleState) {
    this.state$.next(newState);
  }
}
