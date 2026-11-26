import { Directive, InjectionToken } from '@angular/core';
import { CheckboxGroupDirective } from '../../../../forms/components/checkbox/directives/checkbox-group';
import { MenuGroupDirective } from '../menu-group.directive';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const MENU_CHECKBOX_GROUP_TOKEN = new InjectionToken<MenuCheckboxGroupDirective>('MENU_CHECKBOX_GROUP_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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
