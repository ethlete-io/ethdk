import { Component, ViewEncapsulation } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { CAROUSEL_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-carousel-default-example',
  template: `
    <div class="example-carousel-frame">
      <et-carousel itemSize="half" slideAlign="center" loop>
        <ng-template [etCarouselSlide]="SLIDES" let-slide let-index="index" let-count="count">
          <div class="example-carousel-slide" etAutoSurface>
            <p class="example-carousel-title">{{ index + 1 }}. {{ slide.title }}</p>
            <p>{{ slide.body }}</p>
            <p class="example-carousel-count">slide {{ index + 1 }} of {{ count }}</p>
          </div>
        </ng-template>
      </et-carousel>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CAROUSEL_IMPORTS, AutoSurfaceDirective],
  styles: `
    .example-carousel-frame {
      max-inline-size: 720px;
      --et-carousel-slide-gap: 16px;
    }

    .example-carousel-slide {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 8px;
      block-size: 100%;
      min-block-size: 180px;
      padding: 20px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 12px;
      background: var(--et-surface-background-solid);
    }

    .example-carousel-slide p {
      margin: 0;
    }

    .example-carousel-title {
      font-size: 1.8rem;
    }

    .example-carousel-count {
      opacity: 0.6;
    }
  `,
})
export class CarouselDefaultExampleComponent {
  protected readonly SLIDES = [
    { title: 'Kickoff', body: 'The first slide, with its neighbours peeking in on both sides.' },
    { title: 'Half time', body: 'Slides are whatever you put in them - this one is text.' },
    { title: 'Full time', body: 'Native scrolling means a swipe works here without any extra code.' },
    { title: 'Extra time', body: 'Four and five exist so the dots have something to say.' },
    { title: 'Penalties', body: 'The last slide. With loop on, next carries straight on into the first.' },
  ];
}
