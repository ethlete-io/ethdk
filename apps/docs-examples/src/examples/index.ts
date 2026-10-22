import { Type } from '@angular/core';
import { FORMS_EXAMPLES } from './forms';
import { SELECT_EXAMPLES } from './select';

export type ExampleLoader = () => Promise<Type<unknown>>;

export const EXAMPLES: Record<string, ExampleLoader> = {
  ...FORMS_EXAMPLES,
  ...SELECT_EXAMPLES,
};
