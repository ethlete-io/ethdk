import { InputDirective, NumberInputDirective } from './headless';
import { InputComponent } from './input.component';
import { NumberInputComponent } from './number-input.component';

export const INPUT_IMPORTS = [InputComponent, InputDirective] as const;

export const NUMBER_INPUT_IMPORTS = [NumberInputComponent, NumberInputDirective] as const;
