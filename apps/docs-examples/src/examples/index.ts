import { Type } from '@angular/core';
import { FORMS_EXAMPLES } from './forms';
import { SELECT_EXAMPLES } from './select';
import { TEXT_INPUTS_EXAMPLES } from './text-inputs';

export type ExampleLoader = () => Promise<Type<unknown>>;

export const EXAMPLES: Record<string, ExampleLoader> = {
  ...FORMS_EXAMPLES,
  ...SELECT_EXAMPLES,
  ...TEXT_INPUTS_EXAMPLES,
};
