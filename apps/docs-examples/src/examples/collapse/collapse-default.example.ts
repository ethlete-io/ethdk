import { Component, signal, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, COLLAPSE_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-collapse-default-example',
  template: `
    <button (click)="open.set(!open())" et-button size="sm" variant="outline" type="button">
      {{ open() ? 'Collapse' : 'Expand' }}
    </button>
    <et-collapse [open]="open()">
      <p class="example-collapse-content">Orders placed before noon leave the warehouse the same day.</p>
    </et-collapse>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [COLLAPSE_IMPORTS, BUTTON_IMPORTS],
  styles: `
    .example-collapse-content {
      padding-block-start: 12px;
    }
  `,
})
export class CollapseDefaultExampleComponent {
  protected open = signal(false);
}
