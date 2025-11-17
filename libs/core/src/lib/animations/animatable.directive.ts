import { computed, Directive, ElementRef, inject, InjectionToken, input, Signal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, filter, fromEvent, map, merge, Subject, switchMap, tap } from 'rxjs';

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
  private animationCancelledSubject$ = new Subject<void>();

  private activeAnimationCount = 0;

  private pendingTransitionIds: string[] = [];
  private activeBatchTransitionId: string | undefined;

  animatedElementOverride = input<HTMLElement | null | undefined>(null, { alias: 'etAnimatable' });

  animatedElement = computed(() => this.animatedElementOverride() ?? this.elementRef.nativeElement);

  animationStart$ = this.animationStartSubject$.asObservable().pipe(debounceTime(0));
  animationEnd$ = this.animationEndSubject$.asObservable().pipe(debounceTime(0));
  animationCancelled$ = this.animationCancelledSubject$.asObservable().pipe(debounceTime(0));

  hostActiveAnimationCount = signal(0);

  totalActiveAnimationCount: Signal<number> = computed(() => {
    const parentCount = this.parent ? this.parent.totalActiveAnimationCount() : 0;
    return parentCount + this.hostActiveAnimationCount();
  });

  isAnimating = computed(() => this.totalActiveAnimationCount() > 0);
  isAnimating$ = toObservable(this.isAnimating);

  constructor() {
    let didEmitStart = false;

    toObservable(this.animatedElement)
      .pipe(
        tap(() => {
          this.hostActiveAnimationCount.set(0);
          this.activeAnimationCount = 0;
        }),
        switchMap((el) =>
          merge(
            merge(
              fromEvent<AnimationEvent>(el, 'animationstart'),
              fromEvent<TransitionEvent>(el, 'transitionstart'),
            ).pipe(
              filter((e) => e.target === el),
              map(() => 'start' as const),
            ),
            merge(fromEvent<AnimationEvent>(el, 'animationend'), fromEvent<TransitionEvent>(el, 'transitionend')).pipe(
              filter((e) => e.target === el),
              map(() => 'end' as const),
            ),
            merge(
              fromEvent<AnimationEvent>(el, 'animationcancel'),
              fromEvent<TransitionEvent>(el, 'transitioncancel'),
            ).pipe(
              filter((e) => e.target === el),
              map(() => 'cancel' as const),
            ),
          ),
        ),
        tap((eventType) => {
          switch (eventType) {
            case 'start': {
              const startingNewBatch = this.activeAnimationCount === 0;
              this.activeAnimationCount++;
              this.hostActiveAnimationCount.update((c) => c + 1);

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
              this.activeAnimationCount = Math.max(0, this.activeAnimationCount - 1);
              this.hostActiveAnimationCount.update((c) => c - 1);

              if (this.activeAnimationCount === 0 && didEmitStart) {
                didEmitStart = false;
                this.animationEndSubject$.next({
                  cancelled: eventType === 'cancel',
                  transitionId: this.activeBatchTransitionId,
                });
                this.activeBatchTransitionId = undefined;
              }
            }
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  setTransitionId(id: string): void {
    this.pendingTransitionIds.push(id);
  }
}
