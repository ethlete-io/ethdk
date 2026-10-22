import { Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, DIVIDER_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-divider-vertical-example',
  template: `
    <div class="example-toolbar">
      <button et-button size="sm" variant="outline" type="button">Save</button>
      <et-divider orientation="vertical" />
      <button et-button size="sm" variant="outline" type="button">Duplicate</button>
      <et-divider orientation="vertical" />
      <button et-button size="sm" variant="outline" type="button">Delete</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [DIVIDER_IMPORTS, BUTTON_IMPORTS],
  styles: `
    .example-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `,
})
export class DividerVerticalExampleComponent {}
