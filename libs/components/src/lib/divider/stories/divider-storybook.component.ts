import { Component, input, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '../../button';
import { DividerOrientation } from '../divider.component';
import { DIVIDER_IMPORTS } from '../divider.imports';

@Component({
  selector: 'et-sb-divider',
  template: `
    <div [style.max-inline-size.px]="520" class="p-8 font-sans">
      @if (orientation() === 'horizontal') {
        <p class="text-medium">Notifications</p>
        <et-divider [decorative]="decorative()" />
        <p class="text-medium">Privacy</p>
        <et-divider [decorative]="decorative()" />
        <p class="text-medium">Danger zone</p>
      } @else {
        <div class="flex items-center gap-2">
          <button et-button size="sm" variant="outline" type="button">Save</button>
          <et-divider [decorative]="decorative()" orientation="vertical" />
          <button et-button size="sm" variant="outline" type="button">Duplicate</button>
          <et-divider [decorative]="decorative()" orientation="vertical" />
          <button et-button size="sm" variant="outline" type="button">Delete</button>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [DIVIDER_IMPORTS, BUTTON_IMPORTS],
})
export class DividerStorybookComponent {
  public orientation = input<DividerOrientation>('horizontal');

  public decorative = input(false);
}
