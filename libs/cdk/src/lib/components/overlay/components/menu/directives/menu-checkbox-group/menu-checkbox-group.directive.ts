import { Directive, InjectionToken } from '@angular/core';
import { CheckboxGroupDirective } from '../../../../../forms/components/checkbox/directives/checkbox-group';
import { MenuGroupDirective } from '../menu-group';

export const MENU_CHECKBOX_GROUP_TOKEN = new InjectionToken<MenuCheckboxGroupDirective>('MENU_CHECKBOX_GROUP_TOKEN');

@Directive({
  selector: 'et-menu-checkbox-group, [et-menu-checkbox-group], [etMenuCheckboxGroup]',

  providers: [
    {
      provide: MENU_CHECKBOX_GROUP_TOKEN,
      useExisting: MenuCheckboxGroupDirective,
    },
  ],
  hostDirectives: [MenuGroupDirective, CheckboxGroupDirective],
})
export class MenuCheckboxGroupDirective {}
