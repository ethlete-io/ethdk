import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-carousel-next-button',
  template: ``,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-carousel-next-button-host',
  },
  imports: [],
  hostDirectives: [],
})
export class CarouselNextButtonComponent {}
