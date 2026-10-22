import { Component, ViewEncapsulation } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { CAROUSEL_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-carousel-default-example',
  template: `
    <div class="example-carousel-frame">
      <et-carousel loop>
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
    }

    .example-carousel-slide {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 8px;
      block-size: 100%;
      min-block-size: 200px;
      padding: 24px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 12px;
      background: var(--et-surface-background-solid);
    }

    .example-carousel-slide p {
      margin: 0;
    }

    .example-carousel-title {
      font-size: 2rem;
    }

    .example-carousel-count {
      opacity: 0.6;
    }
  `,
})
export class CarouselDefaultExampleComponent {
  protected readonly SLIDES = [
    { title: 'Kickoff', body: 'The first slide, wide enough to fill the track on its own.' },
    { title: 'Half time', body: 'Slides are whatever you put in them - this one is text.' },
    { title: 'Full time', body: 'Native scrolling means a swipe works here without any extra code.' },
    { title: 'Extra time', body: 'Four and five exist so the dots have something to say.' },
    { title: 'Penalties', body: 'The last slide. With loop on, next carries straight on into the first.' },
  ];
}
