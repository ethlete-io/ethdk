import { Component, ViewEncapsulation, input } from '@angular/core';
import { ProvideColorDirective, ProvideSurfaceDirective } from '@ethlete/core';
import { CAROUSEL_IMPORTS } from '../carousel.imports';
import { CarouselSlideAlign, CarouselTransition, CarouselTransitionDriver } from '../headless';
import { SCROLLABLE_DRAG_IMPORTS, SCROLLABLE_IMPORTS } from '../../scrollable';
import { ScrollableItemSize } from '../../scrollable';

type Slide = { title: string; body: string };

const SLIDES: Slide[] = [
  { title: 'Kickoff', body: 'The first slide, wide enough to fill the track on its own.' },
  { title: 'Half time', body: 'Slides are whatever you put in them - this one is text.' },
  { title: 'Full time', body: 'Native scrolling means a swipe works here without any extra code.' },
  { title: 'Extra time', body: 'Four and five exist so the dots have something to say.' },
  { title: 'Penalties', body: 'The last slide. With loop on, next carries straight on into the first.' },
];

@Component({
  selector: 'et-sb-carousel',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-8 p-8 font-sans">
      <div [style.max-inline-size.px]="720">
        <et-carousel
          [itemSize]="itemSize()"
          [loop]="loop()"
          [autoplay]="autoplay()"
          [autoplayTime]="autoplayTime()"
          [showControls]="showControls()"
          [showDots]="showDots()"
          [slideAlign]="slideAlign()"
          [transition]="transition()"
          [transitionDriver]="transitionDriver()"
          style="--et-carousel-slide-gap: 1.6rem"
        >
          <ng-template [etCarouselSlide]="SLIDES" let-slide let-index="index" let-count="count">
            <div
              [style.background]="'var(--et-surface-background-solid)'"
              [style.min-block-size.px]="200"
              class="flex h-full flex-col justify-end gap-2 rounded-xl border border-white/15 p-6"
              etAutoSurface
            >
              <p class="text-h4 m-0">{{ index + 1 }}. {{ slide.title }}</p>
              <p class="text-small m-0">{{ slide.body }}</p>
              <p class="text-small m-0 opacity-60">slide {{ index + 1 }} of {{ count }}</p>
            </div>
          </ng-template>
        </et-carousel>
      </div>

      <p class="text-small">
        Drag with a pointer, swipe on a touch screen, or use the controls - the track is a native scroller, so all three
        are the same gesture underneath. With <code>loop</code> on, keep going past either end: the carousel carries
        clones of the slides on both sides of the seam and shifts its scroll offset across it once the scrolling has
        stopped, so there is no end to arrive at.
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CAROUSEL_IMPORTS, ProvideSurfaceDirective],
})
export class CarouselStorybookComponent {
  public surface = input('dark');
  public itemSize = input<ScrollableItemSize>('full');
  public loop = input(true);
  public autoplay = input(false);
  public autoplayTime = input(5000);
  public showControls = input(true);
  public showDots = input(true);
  public transition = input<CarouselTransition>('none');
  public transitionDriver = input<CarouselTransitionDriver>('auto');
  public slideAlign = input<CarouselSlideAlign>('start');

  protected readonly SLIDES = SLIDES;
}

@Component({
  selector: 'et-sb-carousel-wipe',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-6 p-8 font-sans">
      <div [style.max-inline-size.px]="720">
        <et-carousel [transitionDriver]="transitionDriver()" itemSize="full" transition="wipe" loop>
          <ng-template [etCarouselSlide]="WIPE_SLIDES" let-slide let-index="index">
            <div
              [style.background]="
                'linear-gradient(135deg, hsl(' + slide.hue + ' 62% 32%), hsl(' + slide.hue + ' 72% 14%))'
              "
              [style.block-size.px]="260"
              class="flex flex-col items-center justify-center gap-2 text-white"
            >
              <p class="text-h1 m-0">{{ index + 1 }}</p>
              <p class="text-h4 m-0">{{ slide.title }}</p>
            </div>
          </ng-template>
        </et-carousel>
      </div>

      <p [style.max-inline-size.px]="720" class="text-small">
        Drag slowly, or hold the arrow: the two slides stay still while the edge between them sweeps across. That is the
        difference between a wipe and a slide - the pictures are pinned to the track, only the boundary moves.
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CAROUSEL_IMPORTS, ProvideSurfaceDirective],
})
export class CarouselWipeStorybookComponent {
  public surface = input('dark');
  public transitionDriver = input<CarouselTransitionDriver>('auto');

  protected readonly WIPE_SLIDES = [
    { title: 'Kickoff', hue: 152 },
    { title: 'Half time', hue: 24 },
    { title: 'Full time', hue: 268 },
    { title: 'Extra time', hue: 200 },
    { title: 'Penalties', hue: 336 },
  ];
}

@Component({
  selector: 'et-sb-carousel-variable-widths',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-4 p-8 font-sans">
      <div [style.max-inline-size.px]="720">
        <et-carousel
          [transition]="transition()"
          style="--et-carousel-slide-gap: 1.6rem"
          itemSize="auto"
          slideAlign="center"
          loop
        >
          <ng-template [etCarouselSlide]="WIDTHS" let-width let-index="index">
            <div
              [style.inline-size.px]="width"
              [style.background]="'var(--et-surface-background-solid)'"
              class="text-small flex h-full items-center justify-center rounded-xl border border-white/15 p-6"
              etAutoSurface
            >
              {{ index + 1 }} · {{ width }}px
            </div>
          </ng-template>
        </et-carousel>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CAROUSEL_IMPORTS, ProvideSurfaceDirective],
})
export class CarouselVariableWidthsStorybookComponent {
  public surface = input('dark');
  public transition = input<CarouselTransition>('none');

  protected readonly WIDTHS = [320, 180, 420, 240, 300, 200, 360];
}

@Component({
  selector: 'et-sb-carousel-headless',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-4 p-8 font-sans">
      <div
        #carousel="etCarousel"
        class="flex flex-col gap-6"
        etProvideColor="brand"
        style="max-inline-size: 640px"
        etCarousel
      >
        <div class="flex items-end justify-between">
          <h3 class="text-h5 font-title">Match day</h3>
          <span class="text-h5 font-display tabular-nums">
            {{ pad(carousel.activeIndex() + 1) }}
            <span class="text-small opacity-50">/ {{ pad(carousel.count()) }}</span>
          </span>
        </div>

        <et-scrollable
          renderMasks="false"
          etScrollableSnap
          itemSize="half"
          scrollableClass="gap-4"
          scrollMode="element"
        >
          @for (slide of SLIDES; track slide.title; let index = $index) {
            <div
              [style.background]="
                'linear-gradient(' +
                (140 + index * 25) +
                'deg, color-mix(in oklab, var(--et-theme-color-primary-solid) ' +
                (70 - index * 10) +
                '%, transparent), color-mix(in oklab, var(--et-theme-color-primary-solid) 8%, transparent))'
              "
              class="flex min-h-[16rem] flex-col justify-end gap-2 overflow-hidden rounded-2xl p-6"
              etCarouselItem
            >
              <span class="text-small font-display opacity-60">{{ pad(index + 1) }}</span>
              <span class="text-h5 font-title">{{ slide.title }}</span>
              <span class="text-small opacity-80">{{ slide.body }}</span>
            </div>
          }
        </et-scrollable>

        <div class="flex items-center gap-4">
          <div class="flex flex-1 gap-2">
            @for (slide of SLIDES; track slide.title; let index = $index) {
              <button
                [style.background]="'var(--et-theme-color-primary-solid)'"
                [style.opacity]="index === carousel.activeIndex() ? 1 : 0.25"
                [attr.aria-label]="'Go to ' + slide.title"
                [attr.aria-current]="index === carousel.activeIndex() ? 'true' : null"
                (click)="carousel.goTo(index)"
                class="h-[0.4rem] flex-1 cursor-pointer rounded-full border-0 p-0 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4"
                type="button"
              ></button>
            }
          </div>

          <div class="flex gap-2">
            <button
              class="flex size-[3.6rem] cursor-pointer items-center justify-center rounded-full border border-white/20 bg-transparent transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2"
              etCarouselPrevious
            >
              &larr;
            </button>
            <button
              class="flex size-[3.6rem] cursor-pointer items-center justify-center rounded-full border border-white/20 bg-transparent transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2"
              etCarouselNext
            >
              &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CAROUSEL_IMPORTS,
    SCROLLABLE_IMPORTS,
    SCROLLABLE_DRAG_IMPORTS,
    ProvideColorDirective,
    ProvideSurfaceDirective,
  ],
})
export class CarouselHeadlessStorybookComponent {
  public surface = input('dark');

  protected readonly SLIDES = SLIDES;

  protected pad(value: number) {
    return value.toString().padStart(2, '0');
  }
}
