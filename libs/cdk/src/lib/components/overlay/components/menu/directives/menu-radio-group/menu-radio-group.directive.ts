import { Directive, InjectionToken, forwardRef } from '@angular/core';
import {
  DynamicFormGroupDirective,
  RadioGroupDirective,
  StaticFormGroupDirective,
  WriteableInputDirective,
} from '../../../../../forms';
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
