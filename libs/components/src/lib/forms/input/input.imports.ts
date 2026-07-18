import { InputDirective, NumberInputDirective, PasswordInputDirective } from './headless';
import { InputComponent } from './input.component';
import { NumberInputComponent } from './number-input.component';
import { PasswordInputComponent } from './password-input.component';

export const INPUT_IMPORTS = [InputComponent, InputDirective] as const;

export const NUMBER_INPUT_IMPORTS = [NumberInputComponent, NumberInputDirective] as const;

export const PASSWORD_INPUT_IMPORTS = [PasswordInputComponent, PasswordInputDirective] as const;
