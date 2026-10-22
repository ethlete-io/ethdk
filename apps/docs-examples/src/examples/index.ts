import { Type } from '@angular/core';
import { CALENDAR_EXAMPLES } from './calendar';
import { CASCADER_EXAMPLES } from './cascader';
import { CHOICE_INPUTS_EXAMPLES } from './choice-inputs';
import { DATE_TIME_INPUTS_EXAMPLES } from './date-time-inputs';
import { FORMS_EXAMPLES } from './forms';
import { SELECT_EXAMPLES } from './select';
import { TIME_PICKER_EXAMPLES } from './time-picker';
import { TEXT_INPUTS_EXAMPLES } from './text-inputs';

export type ExampleLoader = () => Promise<Type<unknown>>;

export const EXAMPLES: Record<string, ExampleLoader> = {
  ...CALENDAR_EXAMPLES,
  ...CASCADER_EXAMPLES,
  ...CHOICE_INPUTS_EXAMPLES,
  ...DATE_TIME_INPUTS_EXAMPLES,
  ...FORMS_EXAMPLES,
  ...SELECT_EXAMPLES,
  ...TEXT_INPUTS_EXAMPLES,
  ...TIME_PICKER_EXAMPLES,
};
