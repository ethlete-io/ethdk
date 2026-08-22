import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { AccessibleNameCase, describeAccessibleNameContract } from '../testing/accessible-name';
import { CASCADER_IMPORTS } from '../cascader/cascader.imports';
import { CHECKBOX_IMPORTS } from '../checkbox/checkbox.imports';
import { DATE_INPUT_IMPORTS } from '../date-time/date-input/date-input.imports';
import { DATE_RANGE_INPUT_IMPORTS } from '../date-time/date-range-input/date-range-input.imports';
import { DATE_TIME_INPUT_IMPORTS } from '../date-time/date-time-input/date-time-input.imports';
import { DATE_TIME_RANGE_INPUT_IMPORTS } from '../date-time/date-time-range-input/date-time-range-input.imports';
import { DURATION_INPUT_IMPORTS } from '../date-time/duration-input/duration-input.imports';
import { TIME_INPUT_IMPORTS } from '../date-time/time-input/time-input.imports';
import { TIME_RANGE_INPUT_IMPORTS } from '../date-time/time-range-input/time-range-input.imports';
import { DROPZONE_IMPORTS } from '../dropzone/dropzone.imports';
import { INPUT_IMPORTS } from '../input/input.imports';
import { OTP_INPUT_IMPORTS } from '../otp-input/otp-input.imports';
import { PHONE_INPUT_IMPORTS } from '../phone-input/phone-input.imports';
import { RATING_IMPORTS } from '../rating/rating.imports';
import { RICH_TEXT_EDITOR_IMPORTS } from '../rich-text-editor/rich-text-editor.imports';
import { SELECT_IMPORTS } from '../select/select.imports';
import {
  CHECKBOX_GROUP_IMPORTS,
  RADIO_GROUP_IMPORTS,
  SEGMENTED_BUTTON_IMPORTS,
} from '../selection-list/selection-list.imports';
import { SWITCH_IMPORTS } from '../switch/switch.imports';
import { TAG_INPUT_IMPORTS } from '../tag-input/tag-input.imports';
import { FORM_FIELD_IMPORTS } from './form-field.imports';

const query = (selector: string) => (host: HTMLElement) => host.querySelector(selector);

/** A control the consumer wraps in an `<et-form-field>` themselves. */
const inField = (selector: string, extra = ''): AccessibleNameCase['template'] => {
  return (naming) => `<et-form-field><${selector} ${extra} ${naming} /></et-form-field>`;
};

const CASES: AccessibleNameCase[] = [
  {
    selector: 'et-input',
    imports: [FORM_FIELD_IMPORTS, INPUT_IMPORTS],
    template: inField('et-input'),
    namedElement: query('input'),
  },
  {
    selector: 'et-date-input',
    imports: [FORM_FIELD_IMPORTS, DATE_INPUT_IMPORTS],
    template: inField('et-date-input'),
    namedElement: query('input'),
  },
  {
    selector: 'et-time-input',
    imports: [FORM_FIELD_IMPORTS, TIME_INPUT_IMPORTS],
    template: inField('et-time-input'),
    namedElement: query('input'),
  },
  {
    selector: 'et-date-time-input',
    imports: [FORM_FIELD_IMPORTS, DATE_TIME_INPUT_IMPORTS],
    template: inField('et-date-time-input'),
    namedElement: query('input'),
  },
  {
    selector: 'et-date-range-input',
    imports: [FORM_FIELD_IMPORTS, DATE_RANGE_INPUT_IMPORTS],
    template: inField('et-date-range-input'),
    namedElement: query('et-date-range-input'),
  },
  {
    selector: 'et-time-range-input',
    imports: [FORM_FIELD_IMPORTS, TIME_RANGE_INPUT_IMPORTS],
    template: inField('et-time-range-input'),
    namedElement: query('et-time-range-input'),
  },
  {
    selector: 'et-date-time-range-input',
    imports: [FORM_FIELD_IMPORTS, DATE_TIME_RANGE_INPUT_IMPORTS],
    template: inField('et-date-time-range-input'),
    namedElement: query('et-date-time-range-input'),
  },
  {
    selector: 'et-duration-input',
    imports: [FORM_FIELD_IMPORTS, DURATION_INPUT_IMPORTS],
    template: inField('et-duration-input'),
    namedElement: query('input'),
  },
  {
    selector: 'et-phone-input',
    imports: [FORM_FIELD_IMPORTS, PHONE_INPUT_IMPORTS],
    template: inField('et-phone-input'),
    namedElement: query('input[type="tel"]'),
  },
  {
    selector: 'et-tag-input',
    imports: [FORM_FIELD_IMPORTS, TAG_INPUT_IMPORTS],
    template: inField('et-tag-input'),
    namedElement: query('input'),
  },
  {
    selector: 'et-select',
    imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS],
    template: inField('et-select'),
    namedElement: query('[role="combobox"]'),
  },
  {
    selector: 'et-cascader',
    imports: [FORM_FIELD_IMPORTS, CASCADER_IMPORTS],
    template: inField('et-cascader'),
    namedElement: query('[role="combobox"]'),
  },
  {
    selector: 'et-rich-text-editor',
    imports: [FORM_FIELD_IMPORTS, RICH_TEXT_EDITOR_IMPORTS],
    template: inField('et-rich-text-editor'),
    namedElement: query('[role="textbox"]'),
  },
  {
    selector: 'et-checkbox',
    imports: [FORM_FIELD_IMPORTS, CHECKBOX_IMPORTS],
    template: inField('et-checkbox'),
    namedElement: query('et-checkbox'),
  },
  {
    selector: 'et-switch',
    imports: [FORM_FIELD_IMPORTS, SWITCH_IMPORTS],
    template: inField('et-switch'),
    namedElement: query('et-switch'),
  },
  {
    selector: 'et-otp-input',
    imports: [OTP_INPUT_IMPORTS],
    template: (naming) => `<et-otp-input ${naming} />`,
    namedElement: query('input'),
  },
  {
    selector: 'et-rating',
    imports: [RATING_IMPORTS],
    template: (naming) => `<et-rating ${naming} />`,
    namedElement: query('et-rating'),
  },
  {
    selector: 'et-radio-group',
    imports: [RADIO_GROUP_IMPORTS],
    template: (naming) => `<et-radio-group ${naming}><et-radio value="a">A</et-radio></et-radio-group>`,
    namedElement: query('et-radio-group'),
  },
  {
    selector: 'et-checkbox-group',
    imports: [CHECKBOX_GROUP_IMPORTS],
    template: (naming) =>
      `<et-checkbox-group ${naming}><et-checkbox-option value="a">A</et-checkbox-option></et-checkbox-group>`,
    namedElement: query('et-checkbox-group'),
  },
  {
    selector: 'et-segmented-button-group',
    imports: [SEGMENTED_BUTTON_IMPORTS],
    template: (naming) =>
      `<et-segmented-button-group ${naming}><et-segmented-button value="a">A</et-segmented-button></et-segmented-button-group>`,
    namedElement: query('et-segmented-button-group'),
  },
  {
    selector: 'et-dropzone',
    imports: [DROPZONE_IMPORTS],
    template: (naming) => `<et-dropzone [upload]="upload" ${naming} />`,
    namedElement: query('.et-dropzone-trigger'),
    state: {
      // nothing here uploads - the dropzone only needs its required input to be readable
      upload: {
        selectValue: (response: unknown) => String(response),
        createUploadHandle: () => {
          throw new Error('the accessible-name spec never uploads');
        },
        deleteIncludesExisting: false,
      },
    },
  },
];

describeAccessibleNameContract(CASES, [provideColorThemes(TEST_COLOR_THEMES)]);
