import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-carousel-toggle-auto-play-button',
  template: ``,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-carousel-toggle-auto-play-button-host',
  },
  imports: [],
  hostDirectives: [],
})
export class CarouselToggleAutoPlayButtonComponent {}
