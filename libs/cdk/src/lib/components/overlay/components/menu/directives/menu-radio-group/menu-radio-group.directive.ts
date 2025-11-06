import { Directive, InjectionToken, forwardRef } from '@angular/core';
import { RadioGroupDirective } from '../../../../../forms/components/radio/directives/radio-group';
import { DynamicFormGroupDirective } from '../../../../../forms/directives/dynamic-form-group';
import { StaticFormGroupDirective } from '../../../../../forms/directives/static-form-group';
import { WriteableInputDirective } from '../../../../../forms/directives/writeable-input';
import { MenuGroupDirective } from '../menu-group';

export const MENU_RADIO_GROUP_TOKEN = new InjectionToken<MenuRadioGroupDirective>('MENU_RADIO_GROUP_TOKEN');

@Directive({
  selector: 'et-menu-radio-group, [et-menu-radio-group], [etMenuRadioGroup]',
  standalone: true,
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
