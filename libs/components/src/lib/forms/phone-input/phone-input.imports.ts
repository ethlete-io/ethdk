import { PhoneInputDirective, PhoneInputFieldDirective, PhoneInputFlagDirective } from './headless';
import { PhoneInputComponent } from './phone-input.component';

export const PHONE_INPUT_IMPORTS = [
  PhoneInputComponent,
  PhoneInputDirective,
  PhoneInputFieldDirective,
  PhoneInputFlagDirective,
] as const;
