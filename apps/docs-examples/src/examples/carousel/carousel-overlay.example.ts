import { Component, ViewEncapsulation } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { CAROUSEL_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-carousel-overlay-example',
  template: `
    <div class="example-carousel-overlay-frame">
      <et-carousel [autoplayTime]="4000" controlsPosition="overlay" pauseTogglePosition="top-end" autoplay loop>
        <ng-template [etCarouselSlide]="SLIDES" let-slide let-index="index" let-count="count">
          <div class="example-carousel-overlay-slide" etAutoSurface>
            <p class="example-carousel-overlay-title">{{ index + 1 }}. {{ slide.title }}</p>
            <p>{{ slide.body }}</p>
            <p class="example-carousel-overlay-count">slide {{ index + 1 }} of {{ count }}</p>
          </div>
        </ng-template>
      </et-carousel>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CAROUSEL_IMPORTS, AutoSurfaceDirective],
  styles: `
    .example-carousel-overlay-frame {
      max-inline-size: 720px;
      --et-carousel-slide-gap: 16px;
    }

    .example-carousel-overlay-slide {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      gap: 8px;
      block-size: 100%;
      min-block-size: 220px;
      padding: 20px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 12px;
      background: var(--et-surface-background-solid);
    }

    .example-carousel-overlay-slide p {
      margin: 0;
    }

    .example-carousel-overlay-title {
      font-size: 1.8rem;
    }

    .example-carousel-overlay-count {
      opacity: 0.6;
    }
  `,
})
export class CarouselOverlayExampleComponent {
  protected readonly SLIDES = [
    { title: 'Kickoff', body: 'The control bar sits over the bottom of the slide.' },
    { title: 'Half time', body: 'The pause control has moved to the top-end corner.' },
    { title: 'Full time', body: 'Native scrolling means a swipe works here without any extra code.' },
    { title: 'Extra time', body: 'Four and five exist so the dots have something to say.' },
    { title: 'Penalties', body: 'The last slide. With loop on, next carries straight on into the first.' },
  ];
}
