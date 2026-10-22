import { Type } from '@angular/core';
import { AVATAR_EXAMPLES } from './avatar';
import { BADGE_EXAMPLES } from './badge';
import { BANNER_EXAMPLES } from './banner';
import { BUTTON_EXAMPLES } from './button';
import { CALENDAR_EXAMPLES } from './calendar';
import { CASCADER_EXAMPLES } from './cascader';
import { CHIP_EXAMPLES } from './chip';
import { CHOICE_INPUTS_EXAMPLES } from './choice-inputs';
import { COMMAND_PALETTE_EXAMPLES } from './command-palette';
import { COPY_BUTTON_EXAMPLES } from './copy-button';
import { DATE_TIME_INPUTS_EXAMPLES } from './date-time-inputs';
import { DROPZONE_EXAMPLES } from './dropzone';
import { FILTER_OVERLAY_EXAMPLES } from './filter-overlay';
import { FLOATING_ACTION_EXAMPLES } from './floating-action';
import { FORMS_EXAMPLES } from './forms';
import { KBD_EXAMPLES } from './kbd';
import { MENU_EXAMPLES } from './menu';
import { NOTIFICATION_EXAMPLES } from './notification';
import { OVERLAY_EXAMPLES } from './overlay';
import { PAGED_QUERY_TRIGGER_EXAMPLES } from './paged-query-trigger';
import { PAGINATION_EXAMPLES } from './pagination';
import { RICH_TEXT_EDITOR_EXAMPLES } from './rich-text-editor';
import { SELECT_EXAMPLES } from './select';
import { SLIDER_EXAMPLES } from './slider';
import { TABLE_EXAMPLES } from './table';
import { TEXT_INPUTS_EXAMPLES } from './text-inputs';
import { TIME_PICKER_EXAMPLES } from './time-picker';
import { TOGGLETIP_EXAMPLES } from './toggletip';
import { TOOLTIP_EXAMPLES } from './tooltip';

export type ExampleLoader = () => Promise<Type<unknown>>;

export const EXAMPLES: Record<string, ExampleLoader> = {
  ...AVATAR_EXAMPLES,
  ...BADGE_EXAMPLES,
  ...BANNER_EXAMPLES,
  ...BUTTON_EXAMPLES,
  ...CASCADER_EXAMPLES,
  ...CHIP_EXAMPLES,
  ...CHOICE_INPUTS_EXAMPLES,
  ...COMMAND_PALETTE_EXAMPLES,
  ...COPY_BUTTON_EXAMPLES,
  ...DATE_TIME_INPUTS_EXAMPLES,
  ...DROPZONE_EXAMPLES,
  ...FILTER_OVERLAY_EXAMPLES,
  ...FLOATING_ACTION_EXAMPLES,
  ...FORMS_EXAMPLES,
  ...KBD_EXAMPLES,
  ...MENU_EXAMPLES,
  ...NOTIFICATION_EXAMPLES,
  ...OVERLAY_EXAMPLES,
  ...PAGED_QUERY_TRIGGER_EXAMPLES,
  ...PAGINATION_EXAMPLES,
  ...RICH_TEXT_EDITOR_EXAMPLES,
  ...SELECT_EXAMPLES,
  ...SLIDER_EXAMPLES,
  ...TABLE_EXAMPLES,
  ...TEXT_INPUTS_EXAMPLES,
  ...TIME_PICKER_EXAMPLES,
  ...TOGGLETIP_EXAMPLES,
  ...TOOLTIP_EXAMPLES,
  ...CALENDAR_EXAMPLES,
};
