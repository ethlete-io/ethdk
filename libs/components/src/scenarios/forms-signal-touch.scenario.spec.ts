import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import {
  CASCADER_IMPORTS,
  CascaderDataSource,
  CHECKBOX_GROUP_IMPORTS,
  CHECKBOX_IMPORTS,
  COLOR_INPUT_IMPORTS,
  DATE_INPUT_IMPORTS,
  DATE_RANGE_INPUT_IMPORTS,
  DROPZONE_IMPORTS,
  DURATION_INPUT_IMPORTS,
  FORM_FIELD_IMPORTS,
  INPUT_IMPORTS,
  MENU_IMPORTS,
  MULTI_LANGUAGE_RICH_TEXT_EDITOR_IMPORTS,
  NUMBER_INPUT_IMPORTS,
  OTP_INPUT_IMPORTS,
  PASSWORD_INPUT_IMPORTS,
  PHONE_INPUT_IMPORTS,
  provideOverlay,
  provideRichTextEditorDefaultTools,
  RADIO_GROUP_IMPORTS,
  RATING_IMPORTS,
  SEGMENTED_BUTTON_IMPORTS,
  SELECT_IMPORTS,
  SLIDER_IMPORTS,
  SWITCH_IMPORTS,
  TAG_INPUT_IMPORTS,
  TEXTAREA_IMPORTS,
  TIME_INPUT_IMPORTS,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { useScenario } from './harness';

type TouchCase = {
  control: string;
  imports: readonly unknown[];
  initial: unknown;
  template: string;
  leaveFrom: string;
  openFrom?: string;
};

const inMenu = (items: string) =>
  `<div etMenu><button class="menu-trigger" etMenuTrigger type="button">View</button><ng-template etMenuSurface><et-menu>${items}</et-menu></ng-template></div>`;

const cascaderSource: CascaderDataSource<string> = {
  loadChildren: () => [{ value: 'a', label: 'A', isLeaf: true }],
};

const inField = (control: string) => `<et-form-field><et-label>Field</et-label>${control}</et-form-field>`;

const CASES: TouchCase[] = [
  {
    control: 'et-input',
    imports: [INPUT_IMPORTS, FORM_FIELD_IMPORTS],
    initial: '',
    template: inField('<et-input [formField]="f" />'),
    leaveFrom: 'input',
  },
  {
    control: 'et-number-input',
    imports: [NUMBER_INPUT_IMPORTS, FORM_FIELD_IMPORTS],
    initial: null,
    template: inField('<et-number-input [formField]="f" />'),
    leaveFrom: 'input',
  },
  {
    control: 'et-password-input',
    imports: [PASSWORD_INPUT_IMPORTS, FORM_FIELD_IMPORTS],
    initial: '',
    template: inField('<et-password-input [formField]="f" />'),
    leaveFrom: 'input',
  },
  {
    control: 'et-textarea',
    imports: [TEXTAREA_IMPORTS, FORM_FIELD_IMPORTS],
    initial: '',
    template: inField('<et-textarea [formField]="f" />'),
    leaveFrom: 'textarea',
  },
  {
    control: 'et-phone-input',
    imports: [PHONE_INPUT_IMPORTS, FORM_FIELD_IMPORTS],
    initial: '',
    template: inField('<et-phone-input [formField]="f" />'),
    leaveFrom: 'input',
  },
  {
    control: 'et-tag-input',
    imports: [TAG_INPUT_IMPORTS, FORM_FIELD_IMPORTS],
    initial: [],
    template: inField('<et-tag-input [formField]="f" />'),
    leaveFrom: 'input',
  },
  {
    control: 'et-color-input',
    imports: [COLOR_INPUT_IMPORTS, FORM_FIELD_IMPORTS],
    initial: null,
    template: inField('<et-color-input [formField]="f" />'),
    leaveFrom: 'button[etColorPickerTrigger]',
  },
  {
    control: 'et-date-input',
    imports: [DATE_INPUT_IMPORTS, FORM_FIELD_IMPORTS],
    initial: null,
    template: inField('<et-date-input [formField]="f" />'),
    leaveFrom: 'input',
  },
  {
    control: 'et-time-input',
    imports: [TIME_INPUT_IMPORTS, FORM_FIELD_IMPORTS],
    initial: null,
    template: inField('<et-time-input [formField]="f" />'),
    leaveFrom: 'input',
  },
  {
    control: 'et-date-range-input',
    imports: [DATE_RANGE_INPUT_IMPORTS, FORM_FIELD_IMPORTS],
    initial: { start: null, end: null },
    template: inField('<et-date-range-input [formField]="f" />'),
    leaveFrom: 'input',
  },
  {
    control: 'et-duration-input',
    imports: [DURATION_INPUT_IMPORTS, FORM_FIELD_IMPORTS],
    initial: null,
    template: inField('<et-duration-input [formField]="f" />'),
    leaveFrom: 'input',
  },
  {
    control: 'et-select',
    imports: [SELECT_IMPORTS, FORM_FIELD_IMPORTS],
    initial: null,
    template: inField('<et-select [formField]="f"><et-select-option value="a">A</et-select-option></et-select>'),
    leaveFrom: '[etSelectTrigger]',
  },
  {
    control: 'et-cascader',
    imports: [CASCADER_IMPORTS, FORM_FIELD_IMPORTS],
    initial: null,
    template: inField('<et-cascader [formField]="f" [dataSource]="cascaderSource" />'),
    leaveFrom: '[etCascaderTrigger]',
  },
  {
    control: 'et-multi-language-rich-text-editor',
    imports: [MULTI_LANGUAGE_RICH_TEXT_EDITOR_IMPORTS, FORM_FIELD_IMPORTS],
    initial: {},
    template: inField('<et-multi-language-rich-text-editor [formField]="f" [languages]="languages" />'),
    leaveFrom: '.et-rte-content',
  },
  {
    control: 'et-checkbox',
    imports: [CHECKBOX_IMPORTS],
    initial: false,
    template: '<et-checkbox [formField]="f">Agree</et-checkbox>',
    leaveFrom: 'et-checkbox',
  },
  {
    control: 'et-switch',
    imports: [SWITCH_IMPORTS],
    initial: false,
    template: '<et-switch [formField]="f">Notify</et-switch>',
    leaveFrom: 'et-switch',
  },
  {
    control: 'et-checkbox-group',
    imports: [CHECKBOX_GROUP_IMPORTS],
    initial: [],
    template:
      '<et-checkbox-group [formField]="f" aria-label="Field"><et-checkbox-option value="a">A</et-checkbox-option></et-checkbox-group>',
    leaveFrom: 'et-checkbox-option',
  },
  {
    control: 'et-radio-group',
    imports: [RADIO_GROUP_IMPORTS],
    initial: null,
    template: '<et-radio-group [formField]="f" aria-label="Field"><et-radio value="a">A</et-radio></et-radio-group>',
    leaveFrom: 'et-radio',
  },
  {
    control: 'et-segmented-button-group',
    imports: [SEGMENTED_BUTTON_IMPORTS],
    initial: null,
    template:
      '<et-segmented-button-group [formField]="f" aria-label="Field"><et-segmented-button value="a">A</et-segmented-button></et-segmented-button-group>',
    leaveFrom: 'et-segmented-button',
  },
  {
    control: 'et-rating',
    imports: [RATING_IMPORTS],
    initial: null,
    template: '<et-rating [formField]="f" aria-label="Field" />',
    leaveFrom: 'et-rating',
  },
  {
    control: 'et-otp-input',
    imports: [OTP_INPUT_IMPORTS],
    initial: '',
    template: '<et-otp-input [formField]="f" aria-label="Field" />',
    leaveFrom: 'input',
  },
  {
    control: 'et-slider',
    imports: [SLIDER_IMPORTS, FORM_FIELD_IMPORTS],
    initial: 0,
    template: '<et-slider [formField]="f"><et-label>Volume</et-label></et-slider>',
    leaveFrom: '[etSliderThumb]',
  },
  {
    control: 'et-range-slider',
    imports: [SLIDER_IMPORTS],
    initial: [0, 100],
    template: '<et-range-slider [formField]="f" aria-label="Field" />',
    leaveFrom: '[etSliderThumb]',
  },
  {
    control: 'et-dropzone',
    imports: [DROPZONE_IMPORTS],
    initial: null,
    template: '<et-dropzone [formField]="f" aria-label="Field" [upload]="upload" />',
    leaveFrom: '.et-dropzone-trigger',
  },
  {
    control: 'et-menu-checkbox-group',
    imports: [MENU_IMPORTS],
    initial: [],
    template: inMenu(
      '<et-menu-checkbox-group [formField]="f"><et-menu-checkbox-item value="a">A</et-menu-checkbox-item></et-menu-checkbox-group>',
    ),
    leaveFrom: 'et-menu-checkbox-item',
    openFrom: '.menu-trigger',
  },
  {
    control: 'et-menu-radio-group',
    imports: [MENU_IMPORTS],
    initial: null,
    template: inMenu(
      '<et-menu-radio-group [formField]="f"><et-menu-radio-item value="a">A</et-menu-radio-item></et-menu-radio-group>',
    ),
    leaveFrom: 'et-menu-radio-item',
    openFrom: '.menu-trigger',
  },
  {
    control: 'et-menu-checkbox-item',
    imports: [MENU_IMPORTS],
    initial: false,
    template: inMenu('<et-menu-checkbox-item [formField]="f">Show hidden</et-menu-checkbox-item>'),
    leaveFrom: 'et-menu-checkbox-item',
    openFrom: '.menu-trigger',
  },
];

const mountTouchCase = ({ template, imports, initial }: TouchCase) => {
  const Host = Component({ template, imports: [...(imports as never[]), FormField] })(
    class {
      model = signal<unknown>(initial);
      f = form(this.model);
      cascaderSource = cascaderSource;
      languages = [{ code: 'en', label: 'English' }];
      upload = {
        selectValue: (response: unknown) => String(response),
        createUploadHandle: () => {
          throw new Error('the touch scenario never uploads');
        },
        deleteIncludesExisting: false,
      };
    },
  );

  const fixture = TestBed.createComponent(Host);

  return { host: fixture.nativeElement as HTMLElement, field: fixture.componentInstance.f };
};

describe('signal-form touch', () => {
  const scenario = useScenario({
    providers: [provideOverlay(), provideColorThemes(TEST_COLOR_THEMES), provideRichTextEditorDefaultTools()],
  });

  it.each(CASES)('marks the bound field touched when the user leaves $control', (touchCase) => {
    const s = scenario();
    const { host, field } = mountTouchCase(touchCase);

    s.flush();

    expect(field().touched()).toBe(false);

    if (touchCase.openFrom) {
      host.querySelector<HTMLElement>(touchCase.openFrom)?.click();
      s.flush();
    }

    const target = document.querySelector(touchCase.leaveFrom);

    if (!target) throw new Error(`no ${touchCase.leaveFrom} in ${touchCase.control}`);

    target.dispatchEvent(new FocusEvent('focus'));
    target.dispatchEvent(new FocusEvent('blur'));
    s.flush();

    expect(field().touched()).toBe(true);

    if (touchCase.openFrom) {
      s.keydown('Escape', target);
      s.flush();
    }
  });
});
