import { Component, ViewEncapsulation } from '@angular/core';
import { DIVIDER_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-divider-default-example',
  template: `
    <p>Notifications</p>
    <et-divider />
    <p>Privacy</p>
    <et-divider />
    <p>Danger zone</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [DIVIDER_IMPORTS],
})
export class DividerDefaultExampleComponent {}
