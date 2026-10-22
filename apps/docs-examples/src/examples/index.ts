import { Type } from '@angular/core';
import { ACCORDION_EXAMPLES } from './accordion';
import { AVATAR_EXAMPLES } from './avatar';
import { BADGE_EXAMPLES } from './badge';
import { BANNER_EXAMPLES } from './banner';
import { BUTTON_EXAMPLES } from './button';
import { BREADCRUMB_EXAMPLES } from './breadcrumb';
import { CALENDAR_EXAMPLES } from './calendar';
import { CAROUSEL_EXAMPLES } from './carousel';
import { CARD_EXAMPLES } from './card';
import { CASCADER_EXAMPLES } from './cascader';
import { CHART_EXAMPLES } from './chart';
import { CHIP_EXAMPLES } from './chip';
import { CHOICE_INPUTS_EXAMPLES } from './choice-inputs';
import { COMMAND_PALETTE_EXAMPLES } from './command-palette';
import { COPY_BUTTON_EXAMPLES } from './copy-button';
import { DATE_TIME_INPUTS_EXAMPLES } from './date-time-inputs';
import { DESCRIPTION_LIST_EXAMPLES } from './description-list';
import { DIVIDER_EXAMPLES } from './divider';
import { DROPZONE_EXAMPLES } from './dropzone';
import { EMPTY_STATE_EXAMPLES } from './empty-state';
import { FILTER_OVERLAY_EXAMPLES } from './filter-overlay';
import { FLOATING_ACTION_EXAMPLES } from './floating-action';
import { FORMS_EXAMPLES } from './forms';
import { GRID_EXAMPLES } from './grid';
import { ICON_EXAMPLES } from './icon';
import { KBD_EXAMPLES } from './kbd';
import { LOADER_EXAMPLES } from './loader';
import { MASONRY_EXAMPLES } from './masonry';
import { MENU_EXAMPLES } from './menu';
import { MIXED_STATE_EXAMPLES } from './mixed-state';
import { NOTIFICATION_EXAMPLES } from './notification';
import { OVERLAY_EXAMPLES } from './overlay';
import { PAGED_QUERY_TRIGGER_EXAMPLES } from './paged-query-trigger';
import { PAGINATION_EXAMPLES } from './pagination';
import { QUERY_ERROR_EXAMPLES } from './query-error';
import { RICH_TEXT_EDITOR_EXAMPLES } from './rich-text-editor';
import { PICTURE_EXAMPLES } from './picture';
import { PROGRESS_STEPS_EXAMPLES } from './progress-steps';
import { SCROLLABLE_EXAMPLES } from './scrollable';
import { SCROLLBAR_EXAMPLES } from './scrollbar';
import { SELECT_EXAMPLES } from './select';
import { SKELETON_EXAMPLES } from './skeleton';
import { SLIDER_EXAMPLES } from './slider';
import { STREAM_EXAMPLES } from './stream';
import { TABLE_EXAMPLES } from './table';
import { TABS_EXAMPLES } from './tabs';
import { TEXT_INPUTS_EXAMPLES } from './text-inputs';
import { TIME_PICKER_EXAMPLES } from './time-picker';
import { TIMELINE_EXAMPLES } from './timeline';
import { TOGGLETIP_EXAMPLES } from './toggletip';
import { TOOLBAR_EXAMPLES } from './toolbar';
import { TREE_EXAMPLES } from './tree';
import { TOOLTIP_EXAMPLES } from './tooltip';
import { PIE_CHART_EXAMPLES } from './pie-chart';

export type ExampleLoader = () => Promise<Type<unknown>>;

export const EXAMPLES: Record<string, ExampleLoader> = {
  ...ACCORDION_EXAMPLES,
  ...AVATAR_EXAMPLES,
  ...BADGE_EXAMPLES,
  ...BANNER_EXAMPLES,
  ...BUTTON_EXAMPLES,
  ...BREADCRUMB_EXAMPLES,
  ...CAROUSEL_EXAMPLES,
  ...CARD_EXAMPLES,
  ...CASCADER_EXAMPLES,
  ...CHART_EXAMPLES,
  ...CHIP_EXAMPLES,
  ...CHOICE_INPUTS_EXAMPLES,
  ...COMMAND_PALETTE_EXAMPLES,
  ...COPY_BUTTON_EXAMPLES,
  ...DATE_TIME_INPUTS_EXAMPLES,
  ...DESCRIPTION_LIST_EXAMPLES,
  ...DIVIDER_EXAMPLES,
  ...DROPZONE_EXAMPLES,
  ...EMPTY_STATE_EXAMPLES,
  ...FILTER_OVERLAY_EXAMPLES,
  ...FLOATING_ACTION_EXAMPLES,
  ...FORMS_EXAMPLES,
  ...GRID_EXAMPLES,
  ...ICON_EXAMPLES,
  ...KBD_EXAMPLES,
  ...LOADER_EXAMPLES,
  ...MASONRY_EXAMPLES,
  ...MENU_EXAMPLES,
  ...MIXED_STATE_EXAMPLES,
  ...NOTIFICATION_EXAMPLES,
  ...OVERLAY_EXAMPLES,
  ...PAGED_QUERY_TRIGGER_EXAMPLES,
  ...PAGINATION_EXAMPLES,
  ...QUERY_ERROR_EXAMPLES,
  ...RICH_TEXT_EDITOR_EXAMPLES,
  ...PICTURE_EXAMPLES,
  ...PROGRESS_STEPS_EXAMPLES,
  ...SCROLLABLE_EXAMPLES,
  ...SCROLLBAR_EXAMPLES,
  ...SELECT_EXAMPLES,
  ...SKELETON_EXAMPLES,
  ...SLIDER_EXAMPLES,
  ...STREAM_EXAMPLES,
  ...TABLE_EXAMPLES,
  ...TABS_EXAMPLES,
  ...TEXT_INPUTS_EXAMPLES,
  ...TIME_PICKER_EXAMPLES,
  ...TIMELINE_EXAMPLES,
  ...TOGGLETIP_EXAMPLES,
  ...TOOLBAR_EXAMPLES,
  ...TREE_EXAMPLES,
  ...TOOLTIP_EXAMPLES,
  ...CALENDAR_EXAMPLES,
  ...PIE_CHART_EXAMPLES,
};
