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

export const ANIMATABLE_TOKEN = new InjectionToken<AnimatableDirective>('ANIMATABLE_DIRECTIVE_TOKEN');

export interface AnimationEndEvent {
  cancelled: boolean;
  transitionId?: string;
}

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

  private pendingTransitionIds: string[] = [];
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
      merge(fromEvent<AnimationEvent>(el, 'animationstart'), fromEvent<TransitionEvent>(el, 'transitionstart')).pipe(
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
                this.activeBatchTransitionId = this.pendingTransitionIds.shift();
              }

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

                if (this.activeAnimationCount === 0 && didEmitStart) {
                  didEmitStart = false;
                  this.animationEndSubject$.next({
                    cancelled: eventType === 'cancel',
                    transitionId: this.activeBatchTransitionId,
                  });
                  this.activeBatchTransitionId = undefined;
                }
              } else {
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

  setTransitionId(id: string) {
    this.pendingTransitionIds.push(id);
  }

  private updateActiveAnimationCount(delta: number) {
    const newVal = this.activeAnimationCount + delta;
    const clampedVal = Math.max(0, newVal);

    this.activeAnimationCount = clampedVal;
    this.hostActiveAnimationCount$.next(clampedVal);
  }
}
