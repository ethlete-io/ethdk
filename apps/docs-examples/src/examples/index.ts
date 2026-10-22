import { Type } from '@angular/core';
import { CHOICE_INPUTS_EXAMPLES } from './choice-inputs';
import { DATE_TIME_INPUTS_EXAMPLES } from './date-time-inputs';
import { FORMS_EXAMPLES } from './forms';
import { SELECT_EXAMPLES } from './select';
import { TEXT_INPUTS_EXAMPLES } from './text-inputs';

export type ExampleLoader = () => Promise<Type<unknown>>;

export const EXAMPLES: Record<string, ExampleLoader> = {
  ...CHOICE_INPUTS_EXAMPLES,
  ...DATE_TIME_INPUTS_EXAMPLES,
  ...FORMS_EXAMPLES,
  ...SELECT_EXAMPLES,
  ...TEXT_INPUTS_EXAMPLES,
};
