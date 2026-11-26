import { Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-button',
  template: `
    <button et-button type="button" data-testid="button">Filled</button>
    <button et-button variant="outline" size="sm" type="button">Outlined</button>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class ButtonRouteComponent {}
