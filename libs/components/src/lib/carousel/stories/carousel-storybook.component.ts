import { Component, ViewEncapsulation, input } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { CAROUSEL_IMPORTS } from '../carousel.imports';
import { SCROLLABLE_IMPORTS } from '../../scrollable';
import { ScrollableItemSize } from '../../scrollable';

const SLIDES = [
  { title: 'Kickoff', body: 'The first slide, wide enough to fill the track on its own.' },
  { title: 'Half time', body: 'Slides are whatever you put in them — this one is text.' },
  { title: 'Full time', body: 'Native scrolling means a swipe works here without any extra code.' },
  { title: 'Extra time', body: 'Four and five exist so the dots have something to say.' },
  { title: 'Penalties', body: 'The last slide. With loop on, next comes back to Kickoff.' },
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
          [transition]="transition()"
        >
          @for (slide of SLIDES; track slide.title; let index = $index) {
            <div
              [style.background]="'var(--et-surface-background-solid)'"
              [style.min-block-size.px]="200"
              class="flex flex-col justify-end gap-2 rounded-xl border border-white/15 p-6"
              etAutoSurface
              etCarouselItem
            >
              <p class="text-h4 m-0">{{ index + 1 }}. {{ slide.title }}</p>
              <p class="text-small m-0">{{ slide.body }}</p>
            </div>
          }
        </et-carousel>
      </div>

      <p class="text-small">
        Drag with a pointer, swipe on a touch screen, or use the controls — the track is a native scroller, so all three
        are the same gesture underneath.
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
  public transition = input<'none' | 'dim'>('none');

  protected readonly SLIDES = SLIDES;
}

@Component({
  selector: 'et-sb-carousel-headless',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-4 p-8 font-sans">
      <!-- etCarousel wraps the scrollable *and* the controls: everything that needs to find the carousel
           resolves it from an ancestor, and the region role covers the controls too. -->
      <div #carousel="etCarousel" class="flex flex-col gap-4" etCarousel>
        <et-scrollable
          [style.max-inline-size.px]="640"
          [renderButtons]="false"
          [renderMasks]="false"
          itemSize="half"
          scrollMode="element"
          snap
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
  imports: [CAROUSEL_IMPORTS, SCROLLABLE_IMPORTS, ProvideSurfaceDirective],
})
export class CarouselHeadlessStorybookComponent {
  public surface = input('dark');

  protected readonly SLIDES = SLIDES;
}
