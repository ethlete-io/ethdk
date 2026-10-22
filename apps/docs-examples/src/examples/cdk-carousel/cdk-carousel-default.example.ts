import { Component, ViewEncapsulation } from '@angular/core';
import { CarouselImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-carousel-default-example',
  template: `
    <et-carousel [loop]="true" [transitionDuration]="450" transitionType="mask-slide">
      @for (slide of SLIDES; track slide) {
        <et-carousel-item>
          <div class="example-carousel-slide">{{ slide }}</div>
        </et-carousel-item>
      }

      <div class="example-carousel-controls">
        <div class="example-carousel-buttons">
          <button etCarouselPreviousButton aria-label="Previous">Prev</button>
          <button etCarouselNextButton aria-label="Next">Next</button>
        </div>

        <et-carousel-item-nav />
      </div>
    </et-carousel>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CarouselImports],
  styles: `
    .et-carousel-items {
      border-radius: 10px;
      aspect-ratio: 16 / 9;
    }

    .et-carousel-item {
      grid-area: 1 / 1 / 2 / 2;
    }

    .example-carousel-slide {
      display: flex;
      align-items: center;
      justify-content: center;
      block-size: 100%;
      font-size: 2.4rem;
      background: var(--et-theme-color-primary-solid);
    }

    .example-carousel-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-top: 10px;
    }

    .example-carousel-buttons {
      display: flex;
      gap: 10px;
    }
  `,
})
export class CdkCarouselDefaultExampleComponent {
  protected readonly SLIDES = ['One', 'Two', 'Three', 'Four', 'Five'];
}
