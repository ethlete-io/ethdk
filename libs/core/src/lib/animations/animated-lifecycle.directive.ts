import { AfterViewInit, DestroyRef, Directive, ElementRef, inject, InjectionToken, model } from '@angular/core';
import { outputFromObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, defer, filter, from, Observable, of, Subject, switchMap, take, takeUntil, tap } from 'rxjs';
import { injectRenderer } from '../providers';
import { ANIMATABLE_TOKEN, AnimatableDirective } from './animatable.directive';
import { animationDebugLog } from './animation-debug';
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

  private forcedAtFrameId: number | null = null;
  private currentFrameId = 0;

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

    this.trackFrameId();
  }

  private trackFrameId() {
    const updateFrameId = () => {
      this.currentFrameId = requestAnimationFrame(updateFrameId);
    };
    this.currentFrameId = requestAnimationFrame(updateFrameId);

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.currentFrameId);
    });
  }

  ngAfterViewInit() {
    this.isConstructed = true;
  }

  enter() {
    const currentState = this.state$.value;

    if (currentState === 'entering') return;

    if ((currentState === 'init' && !this.isConstructed) || this.skipNextEnter()) {
      this.debugLog('enter: instant (not constructed or skipNextEnter)', { currentState });
      this.updateState('entered');
      this.skipNextEnter.set(false);
      this.addClass(ANIMATION_CLASSES.enterDone);
      this.forcedAtFrameId = null;

      return;
    }

    const isInterrupting = currentState === 'leaving';

    this.updateState('entering');
    this.removeClass(ANIMATION_CLASSES.leaveDone);

    const previousCancel$ = this.cancelCurrentAnimation$;
    this.cancelCurrentAnimation$ = new Subject<void>();

    const transitionId = `enter-${++this.transitionIdCounter}`;
    this.animatable.setTransitionId(transitionId);

    const skipAnimation = this.forcedAtFrameId !== null && this.forcedAtFrameId === this.currentFrameId;
    this.forcedAtFrameId = null;

    this.debugLog(
      `enter: ${skipAnimation ? 'skip (forced this frame)' : isInterrupting ? 'interrupting leave' : 'normal'}`,
      {
        currentState,
        transitionId,
      },
    );

    if (skipAnimation) {
      this.removeClasses(
        ANIMATION_CLASSES.leaveFrom,
        ANIMATION_CLASSES.leaveActive,
        ANIMATION_CLASSES.leaveTo,
        ANIMATION_CLASSES.leaveInterrupt,
      );
      this.updateState('entered');
      this.addClass(ANIMATION_CLASSES.enterDone);
      previousCancel$.next();
      previousCancel$.complete();

      return;
    }

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
      this.debugLog('leave: instant (state is init, enter never ran)');
      this.updateState('left');
      this.addClass(ANIMATION_CLASSES.leaveDone);
      this.forcedAtFrameId = null;

      return;
    }

    const isInterrupting = currentState === 'entering';

    this.updateState('leaving');
    this.removeClass(ANIMATION_CLASSES.enterDone);

    const previousCancel$ = this.cancelCurrentAnimation$;
    this.cancelCurrentAnimation$ = new Subject<void>();

    const transitionId = `leave-${++this.transitionIdCounter}`;
    this.animatable.setTransitionId(transitionId);

    const skipAnimation = this.forcedAtFrameId !== null && this.forcedAtFrameId === this.currentFrameId;
    this.forcedAtFrameId = null;

    this.debugLog(
      `leave: ${skipAnimation ? 'skip (forced this frame)' : isInterrupting ? 'interrupting enter' : 'normal'}`,
      {
        currentState,
        transitionId,
      },
    );

    if (skipAnimation) {
      this.removeClasses(
        ANIMATION_CLASSES.enterFrom,
        ANIMATION_CLASSES.enterActive,
        ANIMATION_CLASSES.enterTo,
        ANIMATION_CLASSES.enterInterrupt,
      );
      this.updateState('left');
      this.addClass(ANIMATION_CLASSES.leaveDone);
      previousCancel$.next();
      previousCancel$.complete();

      return;
    }

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
    this.forcedAtFrameId = this.currentFrameId;
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
    this.forcedAtFrameId = this.currentFrameId;
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
        switchMap(() => this.whenAnimationsSettled()),
        tap(() => this.debugLog(`${transitionId}: settled`)),
        filter(() => this.state$.value === expectedState),
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

    this.whenAnimationsSettled()
      .pipe(
        tap(() => this.debugLog(`${transitionId}: interrupt settled`)),
        filter(() => this.state$.value === expectedState),
        tap(onComplete),
        take(1),
        takeUntil(cancelSignal),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /**
   * Emits once every animation the class change started on this element has finished, or right away
   * when the change starts none - a `transition-duration` of 0 (`prefers-reduced-motion`) or a
   * property whose value did not change.
   *
   * `isAnimating$` cannot replace the reading here: it turns true a frame after the browser commits
   * the style change, so a slow commit reads as "nothing will animate" and ends the transition
   * before its animation starts.
   */
  private whenAnimationsSettled(isFirstRead = true): Observable<void> {
    return defer(() => {
      const running = this.animatable.getRunningAnimations();

      if (!running.length) {
        // Settling on the first read means nothing was ever awaited, so emitting here would reenter
        // the enter()/leave() call still on the stack. Every later read already runs off a promise.
        return isFirstRead ? fromNextFrame() : of(undefined);
      }

      // A running animation may be replaced rather than finished - the browser retargets a transition
      // whose end value changes - so re-read instead of settling on the first batch.
      return from(Promise.allSettled(running.map((animation) => animation.finished))).pipe(
        switchMap(() => this.whenAnimationsSettled(false)),
      );
    });
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
    this.debugLog(`state: ${this.state$.value} → ${newState}`);
    this.state$.next(newState);
  }

  private debugLog(message: string, data?: Record<string, unknown>) {
    const el = this.element;
    const scope = `lifecycle ${el.tagName.toLowerCase()}${el.classList.contains('et-overlay') ? '.et-overlay' : ''}`;

    if (data) {
      animationDebugLog(scope, message, data);
    } else {
      animationDebugLog(scope, message);
    }
  }
}
