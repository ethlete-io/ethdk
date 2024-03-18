import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-carousel-previous-button',
  template: ``,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-carousel-previous-button-host',
  },
  imports: [],
  hostDirectives: [],
})
export class CarouselPreviousButtonComponent {}
