import { Type } from '@angular/core';
import { CALENDAR_EXAMPLES } from './calendar';
import { CASCADER_EXAMPLES } from './cascader';
import { CHOICE_INPUTS_EXAMPLES } from './choice-inputs';
import { DATE_TIME_INPUTS_EXAMPLES } from './date-time-inputs';
import { DROPZONE_EXAMPLES } from './dropzone';
import { FORMS_EXAMPLES } from './forms';
import { MENU_EXAMPLES } from './menu';
import { OVERLAY_EXAMPLES } from './overlay';
import { RICH_TEXT_EDITOR_EXAMPLES } from './rich-text-editor';
import { SELECT_EXAMPLES } from './select';
import { SLIDER_EXAMPLES } from './slider';
import { TOOLTIP_EXAMPLES } from './tooltip';
import { TIME_PICKER_EXAMPLES } from './time-picker';
import { TEXT_INPUTS_EXAMPLES } from './text-inputs';

export type ExampleLoader = () => Promise<Type<unknown>>;

export const EXAMPLES: Record<string, ExampleLoader> = {
  ...CALENDAR_EXAMPLES,
  ...CASCADER_EXAMPLES,
  ...CHOICE_INPUTS_EXAMPLES,
  ...DATE_TIME_INPUTS_EXAMPLES,
  ...DROPZONE_EXAMPLES,
  ...FORMS_EXAMPLES,
  ...MENU_EXAMPLES,
  ...OVERLAY_EXAMPLES,
  ...RICH_TEXT_EDITOR_EXAMPLES,
  ...SELECT_EXAMPLES,
  ...SLIDER_EXAMPLES,
  ...TEXT_INPUTS_EXAMPLES,
  ...TIME_PICKER_EXAMPLES,
  ...TOOLTIP_EXAMPLES,
};
