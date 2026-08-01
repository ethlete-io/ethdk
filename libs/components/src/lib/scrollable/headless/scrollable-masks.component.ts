import { Component, inject, ViewEncapsulation } from '@angular/core';
import { ScrollableDirective } from './scrollable.directive';

@Component({
  selector: 'et-scrollable-masks, [et-scrollable-masks]',
  template: `
    <div class="et-scrollable-mask et-scrollable-mask--start"></div>
    <div class="et-scrollable-mask et-scrollable-mask--end"></div>
  `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-scrollable-masks',
  },
  styles: `
    @layer components {
      .et-scrollable-masks {
        grid-row: 1 / 1;
        grid-column: 1 / 1;
        pointer-events: none;

        .et-scrollable-mask {
          position: absolute;
          opacity: 0;
        }
      }
    }
  `,
})
export class ScrollableMasksComponent {
  private scrollable = inject(ScrollableDirective);

  constructor() {
    this.scrollable.masksDirective.set(this);
    this.scrollable.activateChildIntersections();
  }
}
