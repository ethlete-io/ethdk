import {
  Directive,
  ElementRef,
  InjectionToken,
  Injector,
  booleanAttribute,
  computed,
  contentChildren,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  nextFrame,
  previousSignalValue,
  signalHostAttributes,
  signalHostClasses,
  signalHostStyles,
} from '@ethlete/core';
import { combineLatest, filter, fromEvent, map, merge, of, switchMap, takeWhile, tap, timer } from 'rxjs';
import { CAROUSEL_ITEM_TOKEN } from './et-carousel-item.directive';

export const CAROUSEL_TOKEN = new InjectionToken<CarouselDirective>('CAROUSEL_TOKEN');

export type CarouselTransitionType = 'mask-slide';

export type CarouselTransitionDirection = 'left' | 'right';

@Directive({
  providers: [
    {
      provide: CAROUSEL_TOKEN,
      useExisting: CarouselDirective,
    },
  ],
})
export class CarouselDirective {
  injector = inject(Injector);

  loop = input(true, { transform: booleanAttribute });
  autoPlay = input(false, { transform: booleanAttribute });
  autoPlayTime = input(5000, { transform: numberAttribute });
  pauseAutoPlayOnHover = input(true, { transform: booleanAttribute });
  pauseAutoPlayOnFocus = input(true, { transform: booleanAttribute });
  transitionType = input<CarouselTransitionType>('mask-slide');
  transitionDuration = input(450, { transform: numberAttribute });

  activeIndex = signal(0);
  previousActiveIndex = previousSignalValue(this.activeIndex);
  transitionDirection = signal<CarouselTransitionDirection>('left');
  carouselItemsWrapper = signal<ElementRef<HTMLDivElement> | null>(null);

  isAutoPlayPaused = signal(false);
  isAutoPlayPausedByInternalHover = signal(false);
  isAutoPlayPausedByInternalFocus = signal(false);

  isNavigationLocked = toSignal(
    toObservable(this.activeIndex).pipe(
      switchMap(() => merge(of(true), timer(this.transitionDuration()).pipe(map(() => false)))),
    ),
    {
      initialValue: false,
    },
  );

  items = contentChildren(CAROUSEL_ITEM_TOKEN);

  activeItem = computed(() => this.items()[this.activeIndex()] || null);

  isAtStart = computed(() => this.activeIndex() === 0);
  isAtEnd = computed(() => this.activeIndex() === this.items().length - 1);

  hostClassBindings = signalHostClasses({
    'et-carousel--slide-left': computed(() => this.transitionDirection() === 'left'),
    'et-carousel--slide-right': computed(() => this.transitionDirection() === 'right'),
  });

  hostAttributeBindings = signalHostAttributes({
    'transition-type': this.transitionType,
  });

  hostStyleBindings = signalHostStyles({
    '--_carousel-slide-duration': computed(() => `${this.transitionDuration()}ms`),
  });

  activeItemAutoPlayDuration = computed(() => {
    if (!this.autoPlay()) return null;

    return this.activeItem()?.autoPlayTime() || this.autoPlayTime();
  });

  activeItemAutoPlayProgress = toSignal(
    combineLatest([toObservable(this.activeItemAutoPlayDuration), toObservable(this.activeItem)]).pipe(
      switchMap(([duration]) => {
        if (duration === null) return of(null);

        let elapsed = 0;

        return combineLatest([
          toObservable(this.isAutoPlayPaused, { injector: this.injector }),
          toObservable(this.isAutoPlayPausedByInternalHover, { injector: this.injector }),
          toObservable(this.isAutoPlayPausedByInternalFocus, { injector: this.injector }),
        ]).pipe(
          switchMap(([isPaused, internalIsPausedDueToHover, internalIsPausedDueToFocus]) => {
            if (isPaused || internalIsPausedDueToHover || internalIsPausedDueToFocus) return of(elapsed / duration);

            return timer(0, 100).pipe(
              tap(() => (elapsed += 100)),
              map(() => elapsed / duration),
              takeWhile((progress) => progress < 1, true),
            );
          }),
        );
      }),
    ),
    { initialValue: null },
  );

  shouldPlayNextItem = computed(() => {
    if (!this.autoPlay()) return false;

    return this.activeItemAutoPlayProgress() === 1;
  });

  constructor() {
    combineLatest([toObservable(this.activeItemAutoPlayProgress), toObservable(this.autoPlay)])
      .pipe(
        filter(([progress, autoPlay]) => progress === 1 && autoPlay),
        tap(() => this.next()),
        takeUntilDestroyed(),
      )
      .subscribe();

    combineLatest([toObservable(this.carouselItemsWrapper), toObservable(this.pauseAutoPlayOnHover)])
      .pipe(
        switchMap(([wrapper, pauseOnHover]) => {
          if (!wrapper || !pauseOnHover) {
            this.isAutoPlayPausedByInternalHover.set(false);
            return of(null);
          }

          return merge(
            fromEvent(wrapper.nativeElement, 'mouseenter').pipe(map(() => true)),
            fromEvent(wrapper.nativeElement, 'mouseleave').pipe(map(() => false)),
          ).pipe(tap((isHovering) => this.isAutoPlayPausedByInternalHover.set(isHovering)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    combineLatest([toObservable(this.carouselItemsWrapper), toObservable(this.pauseAutoPlayOnFocus)])
      .pipe(
        switchMap(([wrapper, pauseOnFocus]) => {
          if (!wrapper || !pauseOnFocus) {
            this.isAutoPlayPausedByInternalFocus.set(false);
            return of(null);
          }

          return merge(
            fromEvent(wrapper.nativeElement, 'focusin').pipe(map(() => true)),
            fromEvent(wrapper.nativeElement, 'focusout').pipe(map(() => false)),
          ).pipe(tap((isFocused) => this.isAutoPlayPausedByInternalFocus.set(isFocused)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  next() {
    if (this.isNavigationLocked()) return;

    this.transitionDirection.set('right');

    nextFrame(() => {
      if (this.activeIndex() === this.items().length - 1) {
        if (!this.loop()) return;

        this.activeIndex.set(0);
        return;
      }

      this.activeIndex.set(this.activeIndex() + 1);
    });
  }

  prev() {
    if (this.isNavigationLocked()) return;

    this.transitionDirection.set('left');

    nextFrame(() => {
      if (this.activeIndex() === 0) {
        if (!this.loop()) return;

        this.activeIndex.set(this.items().length - 1);
        return;
      }

      this.activeIndex.set(this.activeIndex() - 1);
    });
  }

  goTo(index: number) {
    if (this.isNavigationLocked()) return;

    this.transitionDirection.set(this.activeIndex() < index ? 'right' : 'left');

    nextFrame(() => {
      this.activeIndex.set(index);
    });
  }

  stopAutoPlay() {
    this.isAutoPlayPaused.set(true);
  }

  resumeAutoPlay() {
    this.isAutoPlayPaused.set(false);
  }
}
