import { ChangeDetectionStrategy, Component, TemplateRef, ViewEncapsulation, inject, viewChild } from '@angular/core';
import { syncSignal } from '@ethlete/core';
import { CAROUSEL_ITEM_TOKEN, CarouselItemDirective } from './et-carousel-item.directive';

@Component({
  selector: 'et-carousel-item',
  template: `
    <ng-template #itemTpl>
      <ng-content />
    </ng-template>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [],
  hostDirectives: [{ directive: CarouselItemDirective, inputs: ['autoPlayTime'] }],
})
export class CarouselItemComponent {
  carouselItem = inject(CAROUSEL_ITEM_TOKEN);

  itemTemplate = viewChild.required<TemplateRef<unknown>>('itemTpl');

  constructor() {
    syncSignal(this.itemTemplate, this.carouselItem.itemTemplate);
  }
}
