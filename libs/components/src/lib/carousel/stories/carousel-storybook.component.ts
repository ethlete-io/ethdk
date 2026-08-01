import { Component, ViewEncapsulation, input } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
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
        >
          <!-- The slides are data plus this one template: binding them here is what types let-slide as a
               Slide rather than unknown, and what lets the carousel stamp the clones a seamless loop needs
               as live views. -->
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

/**
 * Full-bleed, obviously different slides - which a wipe needs to be visible at all. Between two dark cards
 * with their text in a corner there is nothing for the sweeping edge to show.
 */
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

/**
 * Slides of deliberately different widths, so the loop's teleport distance has to be measured rather than
 * computed from `itemSize` - the case `itemSize="auto"` exists for.
 */
@Component({
  selector: 'et-sb-carousel-variable-widths',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-4 p-8 font-sans">
      <div [style.max-inline-size.px]="720">
        <et-carousel [transition]="transition()" itemSize="auto" slideAlign="center" loop>
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
      <!-- etCarousel wraps the scrollable *and* the controls: everything that needs to find the carousel
           resolves it from an ancestor, and the region role covers the controls too. A hand-built carousel
           owns its own DOM, so it renders no clones and loop stays a jump back to the other end. -->
      <div #carousel="etCarousel" class="flex flex-col gap-4" etCarousel>
        <et-scrollable
          [style.max-inline-size.px]="640"
          renderMasks="false"
          etScrollableSnap
          itemSize="half"
          scrollMode="element"
        >
          @for (slide of SLIDES; track slide.title; let index = $index) {
            <div class="text-small rounded-lg border border-white/15 p-4" etCarouselItem>
              {{ index + 1 }}. {{ slide.title }}
            </div>
          }
        </et-scrollable>

        <div class="flex items-center gap-3">
          <button class="text-small underline" etCarouselPrevious>Back</button>
          <span class="text-small">Slide {{ carousel.activeIndex() + 1 }} of {{ carousel.count() }}</span>
          <button class="text-small underline" etCarouselNext>Forward</button>
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CAROUSEL_IMPORTS, SCROLLABLE_IMPORTS, SCROLLABLE_DRAG_IMPORTS, ProvideSurfaceDirective],
})
export class CarouselHeadlessStorybookComponent {
  public surface = input('dark');

  protected readonly SLIDES = SLIDES;
}
