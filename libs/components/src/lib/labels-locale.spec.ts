import { TestBed } from '@angular/core/testing';
import { injectLocale } from '@ethlete/core';
import { describe, expect, it } from 'vitest';
import { avatarLabelsForLocale, DEFAULT_AVATAR_LABELS, GERMAN_AVATAR_LABELS } from './avatar/avatar-labels';
import { bracketLabelsForLocale, DEFAULT_BRACKET_LABELS, GERMAN_BRACKET_LABELS } from './bracket/bracket-labels';
import {
  breadcrumbLabelsForLocale,
  DEFAULT_BREADCRUMB_LABELS,
  GERMAN_BREADCRUMB_LABELS,
} from './breadcrumb/breadcrumb-labels';
import { DEFAULT_CALENDAR_LABELS, calendarLabelsForLocale, GERMAN_CALENDAR_LABELS } from './calendar/calendar-labels';
import { DEFAULT_CAROUSEL_LABELS, carouselLabelsForLocale, GERMAN_CAROUSEL_LABELS } from './carousel/carousel-labels';
import { chartLabelsForLocale, DEFAULT_CHART_LABELS, GERMAN_CHART_LABELS } from './chart/headless/chart-labels';
import { chipLabelsForLocale, DEFAULT_CHIP_LABELS, GERMAN_CHIP_LABELS, injectChipLabels } from './chip/chip-labels';
import {
  copyButtonLabelsForLocale,
  DEFAULT_COPY_BUTTON_LABELS,
  GERMAN_COPY_BUTTON_LABELS,
} from './copy-button/copy-button-labels';
import {
  cascaderLabelsForLocale,
  DEFAULT_CASCADER_LABELS,
  GERMAN_CASCADER_LABELS,
} from './forms/cascader/cascader-labels';
import {
  colorInputLabelsForLocale,
  DEFAULT_COLOR_INPUT_LABELS,
  GERMAN_COLOR_INPUT_LABELS,
} from './forms/color-input/color-input-labels';
import {
  DEFAULT_DATE_TIME_LABELS,
  dateTimeLabelsForLocale,
  GERMAN_DATE_TIME_LABELS,
} from './forms/date-time/date-time-labels';
import {
  DEFAULT_DROPZONE_LABELS,
  dropzoneLabelsForLocale,
  GERMAN_DROPZONE_LABELS,
} from './forms/dropzone/dropzone-labels';
import {
  DEFAULT_FORM_FIELD_LABELS,
  formFieldLabelsForLocale,
  GERMAN_FORM_FIELD_LABELS,
} from './forms/form-field/form-field-labels';
import { DEFAULT_INPUT_LABELS, GERMAN_INPUT_LABELS, inputLabelsForLocale } from './forms/input/input-labels';
import {
  DEFAULT_PHONE_INPUT_LABELS,
  GERMAN_PHONE_INPUT_LABELS,
  phoneInputLabelsForLocale,
} from './forms/phone-input/phone-input-labels';
import {
  DEFAULT_RICH_TEXT_EDITOR_LABELS,
  GERMAN_RICH_TEXT_EDITOR_LABELS,
  richTextEditorLabelsForLocale,
} from './forms/rich-text-editor/rich-text-editor-labels';
import { DEFAULT_SELECT_LABELS, GERMAN_SELECT_LABELS, selectLabelsForLocale } from './forms/select/select-labels';
import { DEFAULT_SLIDER_LABELS, GERMAN_SLIDER_LABELS, sliderLabelsForLocale } from './forms/slider/slider-labels';
import { DEFAULT_GRID_LABELS, GERMAN_GRID_LABELS, gridLabelsForLocale } from './grid/grid-labels';
import { DEFAULT_KBD_LABELS, GERMAN_KBD_LABELS, kbdLabelsForLocale } from './kbd/kbd-labels';
import { DEFAULT_LOADER_LABELS, GERMAN_LOADER_LABELS, loaderLabelsForLocale } from './loader/loader-labels';
import { DEFAULT_MATCH_LABELS, GERMAN_MATCH_LABELS, matchLabelsForLocale } from './match/match-labels';
import {
  DEFAULT_NOTIFICATION_LABELS,
  GERMAN_NOTIFICATION_LABELS,
  notificationLabelsForLocale,
} from './notification/notification-labels';
import {
  DEFAULT_ALERT_DIALOG_LABELS,
  alertDialogLabelsForLocale,
  GERMAN_ALERT_DIALOG_LABELS,
} from './overlay/alert-dialog/alert-dialog-labels';
import {
  DEFAULT_PAGINATION_LABELS,
  GERMAN_PAGINATION_LABELS,
  paginationLabelsForLocale,
} from './pagination/pagination-labels';
import {
  DEFAULT_PROGRESS_STEP_LABELS,
  GERMAN_PROGRESS_STEP_LABELS,
  progressStepLabelsForLocale,
} from './progress-steps/progress-step-labels';
import {
  DEFAULT_SCHEDULER_LABELS,
  GERMAN_SCHEDULER_LABELS,
  schedulerLabelsForLocale,
} from './scheduler/scheduler-labels';
import {
  DEFAULT_STANDINGS_LABELS,
  GERMAN_STANDINGS_LABELS,
  standingsLabelsForLocale,
} from './standings/standings-labels';
import {
  DEFAULT_STAT_TILE_LABELS,
  GERMAN_STAT_TILE_LABELS,
  statTileLabelsForLocale,
} from './stat-tile/stat-tile-labels';
import { DEFAULT_STREAM_LABELS, GERMAN_STREAM_LABELS, streamLabelsForLocale } from './stream/stream-labels';
import { DEFAULT_TABLE_LABELS, GERMAN_TABLE_LABELS, tableLabelsForLocale } from './table/headless/table-labels';
import {
  DEFAULT_TIME_PICKER_LABELS,
  GERMAN_TIME_PICKER_LABELS,
  timePickerLabelsForLocale,
} from './time-picker/time-picker-labels';
import { DEFAULT_TREE_LABELS, GERMAN_TREE_LABELS, treeLabelsForLocale } from './tree/tree-labels';
import {
  DEFAULT_UNSAVED_CHANGES_LABELS,
  GERMAN_UNSAVED_CHANGES_LABELS,
  unsavedChangesLabelsForLocale,
} from './unsaved-changes/unsaved-changes-labels';
import { bannerLabelsForLocale, DEFAULT_BANNER_LABELS, GERMAN_BANNER_LABELS } from './banner/banner-labels';

const sets: [string, object, object, (locale: string) => object][] = [
  ['alert-dialog', DEFAULT_ALERT_DIALOG_LABELS, GERMAN_ALERT_DIALOG_LABELS, alertDialogLabelsForLocale],
  ['avatar', DEFAULT_AVATAR_LABELS, GERMAN_AVATAR_LABELS, avatarLabelsForLocale],
  ['banner', DEFAULT_BANNER_LABELS, GERMAN_BANNER_LABELS, bannerLabelsForLocale],
  ['bracket', DEFAULT_BRACKET_LABELS, GERMAN_BRACKET_LABELS, bracketLabelsForLocale],
  ['breadcrumb', DEFAULT_BREADCRUMB_LABELS, GERMAN_BREADCRUMB_LABELS, breadcrumbLabelsForLocale],
  ['calendar', DEFAULT_CALENDAR_LABELS, GERMAN_CALENDAR_LABELS, calendarLabelsForLocale],
  ['carousel', DEFAULT_CAROUSEL_LABELS, GERMAN_CAROUSEL_LABELS, carouselLabelsForLocale],
  ['cascader', DEFAULT_CASCADER_LABELS, GERMAN_CASCADER_LABELS, cascaderLabelsForLocale],
  ['chart', DEFAULT_CHART_LABELS, GERMAN_CHART_LABELS, chartLabelsForLocale],
  ['chip', DEFAULT_CHIP_LABELS, GERMAN_CHIP_LABELS, chipLabelsForLocale],
  ['color-input', DEFAULT_COLOR_INPUT_LABELS, GERMAN_COLOR_INPUT_LABELS, colorInputLabelsForLocale],
  ['copy-button', DEFAULT_COPY_BUTTON_LABELS, GERMAN_COPY_BUTTON_LABELS, copyButtonLabelsForLocale],
  ['date-time', DEFAULT_DATE_TIME_LABELS, GERMAN_DATE_TIME_LABELS, dateTimeLabelsForLocale],
  ['dropzone', DEFAULT_DROPZONE_LABELS, GERMAN_DROPZONE_LABELS, dropzoneLabelsForLocale],
  ['form-field', DEFAULT_FORM_FIELD_LABELS, GERMAN_FORM_FIELD_LABELS, formFieldLabelsForLocale],
  ['grid', DEFAULT_GRID_LABELS, GERMAN_GRID_LABELS, gridLabelsForLocale],
  ['input', DEFAULT_INPUT_LABELS, GERMAN_INPUT_LABELS, inputLabelsForLocale],
  ['kbd', DEFAULT_KBD_LABELS, GERMAN_KBD_LABELS, kbdLabelsForLocale],
  ['loader', DEFAULT_LOADER_LABELS, GERMAN_LOADER_LABELS, loaderLabelsForLocale],
  ['match', DEFAULT_MATCH_LABELS, GERMAN_MATCH_LABELS, matchLabelsForLocale],
  ['notification', DEFAULT_NOTIFICATION_LABELS, GERMAN_NOTIFICATION_LABELS, notificationLabelsForLocale],
  ['pagination', DEFAULT_PAGINATION_LABELS, GERMAN_PAGINATION_LABELS, paginationLabelsForLocale],
  ['phone-input', DEFAULT_PHONE_INPUT_LABELS, GERMAN_PHONE_INPUT_LABELS, phoneInputLabelsForLocale],
  ['progress-steps', DEFAULT_PROGRESS_STEP_LABELS, GERMAN_PROGRESS_STEP_LABELS, progressStepLabelsForLocale],
  ['rich-text-editor', DEFAULT_RICH_TEXT_EDITOR_LABELS, GERMAN_RICH_TEXT_EDITOR_LABELS, richTextEditorLabelsForLocale],
  ['scheduler', DEFAULT_SCHEDULER_LABELS, GERMAN_SCHEDULER_LABELS, schedulerLabelsForLocale],
  ['select', DEFAULT_SELECT_LABELS, GERMAN_SELECT_LABELS, selectLabelsForLocale],
  ['slider', DEFAULT_SLIDER_LABELS, GERMAN_SLIDER_LABELS, sliderLabelsForLocale],
  ['standings', DEFAULT_STANDINGS_LABELS, GERMAN_STANDINGS_LABELS, standingsLabelsForLocale],
  ['stat-tile', DEFAULT_STAT_TILE_LABELS, GERMAN_STAT_TILE_LABELS, statTileLabelsForLocale],
  ['stream', DEFAULT_STREAM_LABELS, GERMAN_STREAM_LABELS, streamLabelsForLocale],
  ['table', DEFAULT_TABLE_LABELS, GERMAN_TABLE_LABELS, tableLabelsForLocale],
  ['time-picker', DEFAULT_TIME_PICKER_LABELS, GERMAN_TIME_PICKER_LABELS, timePickerLabelsForLocale],
  ['tree', DEFAULT_TREE_LABELS, GERMAN_TREE_LABELS, treeLabelsForLocale],
  ['unsaved-changes', DEFAULT_UNSAVED_CHANGES_LABELS, GERMAN_UNSAVED_CHANGES_LABELS, unsavedChangesLabelsForLocale],
];

describe('German default labels', () => {
  it.each(sets)('%s: German covers every key and the locale picks it', (_name, english, german, forLocale) => {
    expect(Object.keys(german).sort()).toEqual(Object.keys(english).sort());
    expect(forLocale('de')).toBe(german);
    expect(forLocale('de-AT')).toBe(german);
    expect(forLocale('en')).toBe(english);
    expect(forLocale('fr')).toBe(english);
  });

  it('resolves a shipped set to German once the locale switches to de', () => {
    const labels = TestBed.runInInjectionContext(() => injectChipLabels());
    const { currentLocale } = TestBed.runInInjectionContext(() => injectLocale());

    expect(labels().remove).toBe('Remove');

    currentLocale.set('de');
    expect(labels().remove).toBe('Entfernen');
  });
});
