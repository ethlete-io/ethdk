import { Component, ViewEncapsulation } from '@angular/core';
import { MENU_SELECTION_GROUP_MULTIPLE, MenuSelectionGroupDirective } from './headless';

@Component({
  selector: 'et-menu-checkbox-group',
  template: `
    <ng-content select="et-menu-group-label" />
    <ng-content />
  `,
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: MENU_SELECTION_GROUP_MULTIPLE, useValue: true }],
  hostDirectives: [
    {
      directive: MenuSelectionGroupDirective,
      inputs: ['value', 'touched', 'disabled', 'invalid', 'errors', 'required', 'name'],
      outputs: ['valueChange', 'touchedChange'],
    },
  ],
  host: {
    class: 'et-menu-group et-menu-checkbox-group',
  },
})
export class MenuCheckboxGroupComponent {}
