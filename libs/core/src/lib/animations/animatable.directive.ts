import { Directive, ElementRef, inject, InjectionToken } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  filter,
  fromEvent,
  map,
  merge,
  Observable,
  Subject,
  tap,
} from 'rxjs';
import { animationDebugLog } from './animation-debug';

export const ANIMATABLE_TOKEN = new InjectionToken<AnimatableDirective>('ANIMATABLE_DIRECTIVE_TOKEN');

export type AnimationEndEvent = {
  cancelled: boolean;
  transitionId?: string;
};

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
  private parent = inject(ANIMATABLE_TOKEN, { optional: true, skipSelf: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private animationStartSubject$ = new Subject<void>();
  private animationEndSubject$ = new Subject<AnimationEndEvent>();

  private activeAnimationCount = 0;
  private hostActiveAnimationCount$ = new BehaviorSubject<number>(0);

  private pendingTransitionId: string | undefined;
  private activeBatchTransitionId: string | undefined;

  animationStart$ = this.animationStartSubject$.asObservable().pipe(debounceTime(0));
  animationEnd$ = this.animationEndSubject$.asObservable().pipe(debounceTime(0));

  totalActiveAnimationCount$: Observable<number> = this.parent
    ? combineLatest([this.parent.totalActiveAnimationCount$, this.hostActiveAnimationCount$]).pipe(
        map(([parentCount, hostCount]) => Math.max(0, parentCount + hostCount)),
      )
    : this.hostActiveAnimationCount$.pipe(map((count) => Math.max(0, count)));

  isAnimating$ = this.totalActiveAnimationCount$.pipe(map((count) => count > 0));

  constructor() {
    let didEmitStart = false;
    const el = this.elementRef.nativeElement;

    merge(
      merge(fromEvent<AnimationEvent>(el, 'animationstart'), fromEvent<TransitionEvent>(el, 'transitionrun')).pipe(
        filter((e) => e.target === el && !e.pseudoElement),
        map(() => 'start' as const),
      ),
      merge(fromEvent<AnimationEvent>(el, 'animationend'), fromEvent<TransitionEvent>(el, 'transitionend')).pipe(
        filter((e) => e.target === el && !e.pseudoElement),
        map(() => 'end' as const),
      ),
      merge(fromEvent<AnimationEvent>(el, 'animationcancel'), fromEvent<TransitionEvent>(el, 'transitioncancel')).pipe(
        filter((e) => e.target === el && !e.pseudoElement),
        map(() => 'cancel' as const),
      ),
    )
      .pipe(
        tap((eventType) => {
          switch (eventType) {
            case 'start': {
              const startingNewBatch = this.activeAnimationCount === 0;
              this.updateActiveAnimationCount(1);

              if (startingNewBatch) {
                this.activeBatchTransitionId = this.pendingTransitionId;
                this.pendingTransitionId = undefined;
              }

              animationDebugLog(
                `animatable ${el.tagName.toLowerCase()}`,
                `start (count ${this.activeAnimationCount}, batch "${this.activeBatchTransitionId}", pending "${this.pendingTransitionId ?? 'none'}")`,
              );

              if (!didEmitStart) {
                didEmitStart = true;
                this.animationStartSubject$.next();
              }

              break;
            }
            case 'end':
            case 'cancel': {
              if (this.activeAnimationCount > 0) {
                this.updateActiveAnimationCount(-1);

                animationDebugLog(
                  `animatable ${el.tagName.toLowerCase()}`,
                  `${eventType} (count ${this.activeAnimationCount}, batch "${this.activeBatchTransitionId}")`,
                );

                if (this.activeAnimationCount === 0 && didEmitStart) {
                  didEmitStart = false;
                  this.animationEndSubject$.next({
                    cancelled: eventType === 'cancel',
                    transitionId: this.activeBatchTransitionId,
                  });
                  this.activeBatchTransitionId = undefined;
                }
              } else {
                animationDebugLog(
                  `animatable ${el.tagName.toLowerCase()}`,
                  `${eventType} ignored - count already 0 (start ${didEmitStart ? '' : 'not '}emitted)`,
                );
                console.warn(
                  `${el.tagName} received animation end/cancel event but activeAnimationCount is already 0. Start was ${didEmitStart ? '' : 'not '}emitted.`,
                );
              }
              break;
            }
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /**
   * Labels the next batch of animations that starts on this element. Only the most recent id is
   * kept: a call whose animations never start must not leave an id behind for a later batch.
   */
  setTransitionId(id: string) {
    this.pendingTransitionId = id;
  }

  /**
   * The animations running on this element right now, without the endless and pseudo-element ones.
   *
   * Reading this flushes pending style changes, so an animation a class change started in the same
   * task is already listed here. `isAnimating$` cannot answer that: it turns true only once the
   * browser dispatches `transitionrun`, a frame after the style change is committed.
   */
  getRunningAnimations(): Animation[] {
    const el = this.elementRef.nativeElement;

    if (typeof el.getAnimations !== 'function') return [];

    return el.getAnimations().filter((animation) => {
      if (animation.playState !== 'running') return false;

      const effect = animation.effect as KeyframeEffect | null;

      if (!effect || effect.pseudoElement) return false;

      // An endless animation never resolves `finished`, so awaiting one would strand the transition.
      return effect.getComputedTiming().iterations !== Infinity;
    });
  }

  private updateActiveAnimationCount(delta: number) {
    const newVal = this.activeAnimationCount + delta;
    const clampedVal = Math.max(0, newVal);

    this.activeAnimationCount = clampedVal;
    this.hostActiveAnimationCount$.next(clampedVal);
  }
}
