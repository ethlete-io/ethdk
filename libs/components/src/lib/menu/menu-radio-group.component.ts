import { Component, ViewEncapsulation } from '@angular/core';
import { MenuSelectionGroupDirective } from './headless';

@Component({
  selector: 'et-menu-radio-group',
  template: `
    <ng-content select="et-menu-group-label" />
    <ng-content />
  `,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: MenuSelectionGroupDirective,
      inputs: ['value', 'touched', 'disabled', 'invalid', 'errors', 'required', 'name'],
      outputs: ['valueChange', 'touchedChange'],
    },
  ],
  host: {
    class: 'et-menu-group et-menu-radio-group',
  },
})
export class MenuRadioGroupComponent {}
