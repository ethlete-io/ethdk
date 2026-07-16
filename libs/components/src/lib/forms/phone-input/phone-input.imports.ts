import { PhoneInputDirective, PhoneInputFieldDirective } from './headless';
import { PhoneInputComponent } from './phone-input.component';

export const PHONE_INPUT_IMPORTS = [PhoneInputComponent, PhoneInputDirective, PhoneInputFieldDirective] as const;
