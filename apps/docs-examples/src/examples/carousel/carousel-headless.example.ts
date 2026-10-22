import { Component, ViewEncapsulation } from '@angular/core';
import { CAROUSEL_IMPORTS, SCROLLABLE_DRAG_IMPORTS, SCROLLABLE_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-carousel-headless-example',
  template: `
    <div #carousel="etCarousel" class="example-carousel-headless" etCarousel>
      <et-scrollable renderMasks="false" etScrollableSnap itemSize="half" scrollMode="element">
        @for (slide of SLIDES; track slide; let index = $index) {
          <div class="example-carousel-headless-slide" etCarouselItem>{{ index + 1 }}. {{ slide }}</div>
        }
      </et-scrollable>

      <div class="example-carousel-headless-controls">
        <button etCarouselPrevious>Back</button>
        <span>Slide {{ carousel.activeIndex() + 1 }} of {{ carousel.count() }}</span>
        <button etCarouselNext>Forward</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CAROUSEL_IMPORTS, SCROLLABLE_IMPORTS, SCROLLABLE_DRAG_IMPORTS],
  styles: `
    .example-carousel-headless {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-inline-size: 640px;
    }

    .example-carousel-headless-slide {
      padding: 16px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 8px;
    }

    .example-carousel-headless-controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .example-carousel-headless-controls button {
      text-decoration: underline;
    }
  `,
})
export class CarouselHeadlessExampleComponent {
  protected readonly SLIDES = ['Kickoff', 'Half time', 'Full time', 'Extra time', 'Penalties'];
}
