import { Component, ViewEncapsulation } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { CAROUSEL_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-carousel-loop-example',
  template: `
    <div class="example-carousel-frame">
      <et-carousel itemSize="half" loop>
        <ng-template [etCarouselSlide]="SLIDES" let-slide let-index="index">
          <div class="example-carousel-slide" etAutoSurface>{{ index + 1 }}. {{ slide }}</div>
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
      align-items: center;
      justify-content: center;
      block-size: 100%;
      min-block-size: 160px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 12px;
      background: var(--et-surface-background-solid);
    }
  `,
})
export class CarouselLoopExampleComponent {
  protected readonly SLIDES = ['Kickoff', 'Half time', 'Full time', 'Extra time', 'Penalties'];
}
