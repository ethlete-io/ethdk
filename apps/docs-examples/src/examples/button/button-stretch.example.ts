import { Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, KBD_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-button-stretch-example',
  template: `
    <button class="example-search-button" et-button stretchContents type="button" variant="tonal">
      <span class="example-search-label">Search projects</span>
      <et-kbd keys="mod+k" />
    </button>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, KBD_IMPORTS],
  styles: `
    .example-search-button {
      width: 320px;
    }

    .example-search-label {
      flex: 1;
      text-align: start;
    }
  `,
})
export class ButtonStretchExampleComponent {}
