import { Component, input, signal, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '../../button';
import { COLLAPSE_IMPORTS } from '../collapse.imports';

@Component({
  selector: 'et-sb-collapse',
  template: `
    <div [style.max-inline-size.px]="520" class="p-8 font-sans">
      <button (click)="isOpen.set(!isOpen())" et-button size="sm" variant="outline" type="button">
        {{ isOpen() ? 'Collapse' : 'Expand' }}
      </button>
      <et-collapse [open]="isOpen()">
        <div class="pt-4">
          <p class="text-medium">Shipping details</p>
          <p class="text-medium">Orders placed before noon leave the warehouse the same day.</p>
          <p class="text-medium">Delivery takes two to four working days within the country.</p>
        </div>
      </et-collapse>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [COLLAPSE_IMPORTS, BUTTON_IMPORTS],
})
export class CollapseStorybookComponent {
  public open = input(false);

  protected isOpen = signal(false);

  constructor() {
    this.isOpen.set(this.open());
  }
}
