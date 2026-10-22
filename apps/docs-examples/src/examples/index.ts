import { Type } from '@angular/core';
import { SELECT_EXAMPLES } from './select';

export type ExampleLoader = () => Promise<Type<unknown>>;

export const EXAMPLES: Record<string, ExampleLoader> = {
  ...SELECT_EXAMPLES,
};
