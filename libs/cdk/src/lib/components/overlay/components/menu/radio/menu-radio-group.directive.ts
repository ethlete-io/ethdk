import { Directive, InjectionToken, forwardRef } from '@angular/core';
import { RadioGroupDirective } from '../../../../forms/components/radio/directives/radio-group';
import { DynamicFormGroupDirective } from '../../../../forms/directives/dynamic-form-group';
import { StaticFormGroupDirective } from '../../../../forms/directives/static-form-group';
import { WriteableInputDirective } from '../../../../forms/directives/writeable-input';
import { MenuGroupDirective } from '../menu-group.directive';
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const MENU_RADIO_GROUP_TOKEN = new InjectionToken<MenuRadioGroupDirective>('MENU_RADIO_GROUP_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: 'et-menu-radio-group, [et-menu-radio-group], [etMenuRadioGroup]',

  providers: [
    {
      provide: MENU_RADIO_GROUP_TOKEN,
      useExisting: MenuRadioGroupDirective,
    },
  ],
  hostDirectives: [
    MenuGroupDirective,
    StaticFormGroupDirective,
    WriteableInputDirective,
    {
      directive: forwardRef(() => DynamicFormGroupDirective),
    },
    RadioGroupDirective,
  ],
})
export class MenuRadioGroupDirective {}
