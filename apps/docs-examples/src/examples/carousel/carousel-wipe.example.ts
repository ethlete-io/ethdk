import { Component, ViewEncapsulation } from '@angular/core';
import { CAROUSEL_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-carousel-wipe-example',
  template: `
    <div class="example-carousel-frame">
      <et-carousel itemSize="full" transition="wipe" loop>
        <ng-template [etCarouselSlide]="SLIDES" let-slide let-index="index">
          <div [style.--slide-hue]="slide.hue" class="example-carousel-wipe-slide">
            <p class="example-carousel-wipe-index">{{ index + 1 }}</p>
            <p>{{ slide.title }}</p>
          </div>
        </ng-template>
      </et-carousel>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CAROUSEL_IMPORTS],
  styles: `
    .example-carousel-frame {
      max-inline-size: 720px;
    }

    .example-carousel-wipe-slide {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      block-size: 260px;
      color: white;
      background: linear-gradient(135deg, hsl(var(--slide-hue) 62% 32%), hsl(var(--slide-hue) 72% 14%));
    }

    .example-carousel-wipe-slide p {
      margin: 0;
    }

    .example-carousel-wipe-index {
      font-size: 4rem;
    }
  `,
})
export class CarouselWipeExampleComponent {
  protected readonly SLIDES = [
    { title: 'Kickoff', hue: 152 },
    { title: 'Half time', hue: 24 },
    { title: 'Full time', hue: 268 },
    { title: 'Extra time', hue: 200 },
    { title: 'Penalties', hue: 336 },
  ];
}
