import { Component, inject, ViewEncapsulation } from '@angular/core';
import { ScrollableDirective } from './scrollable.directive';

@Component({
  selector: 'et-scrollable-masks, [et-scrollable-masks]',
  template: `
    <div class="et-scrollable-mask et-scrollable-mask--start"></div>
    <div class="et-scrollable-mask et-scrollable-mask--end"></div>
  `,
  styleUrl: './scrollable-masks.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-scrollable-masks',
  },
})
export class ScrollableMasksComponent {
  private scrollable = inject(ScrollableDirective);

  constructor() {
    this.scrollable.masksDirective.set(this);
    this.scrollable.activateChildIntersections();
  }
}
