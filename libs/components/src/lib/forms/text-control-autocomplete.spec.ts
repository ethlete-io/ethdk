import { Component, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../test-helpers';
import { TEST_COLOR_THEMES } from '../testing/color-themes';
import {
  DATE_INPUT_IMPORTS,
  DATE_RANGE_INPUT_IMPORTS,
  DATE_TIME_INPUT_IMPORTS,
  DATE_TIME_RANGE_INPUT_IMPORTS,
  DURATION_INPUT_IMPORTS,
  TIME_INPUT_IMPORTS,
  TIME_RANGE_INPUT_IMPORTS,
} from './date-time';
import { INPUT_IMPORTS, NUMBER_INPUT_IMPORTS, PASSWORD_INPUT_IMPORTS } from './input';
import { PHONE_INPUT_IMPORTS } from './phone-input';
import { SELECT_IMPORTS } from './select';
import { TAG_INPUT_IMPORTS } from './tag-input';
import { TEXTAREA_IMPORTS } from './textarea';

type AutocompleteCase = {
  name: string;
  imports: readonly unknown[];
  template: (attr: string) => string;
  field: string;
  fallback: string | null;
};

const control = (tag: string) => (attr: string) => `<${tag} aria-label="Field" ${attr} />`;

const CASES: AutocompleteCase[] = [
  { name: 'et-input', imports: INPUT_IMPORTS, template: control('et-input'), field: 'input', fallback: null },
  {
    name: 'et-number-input',
    imports: NUMBER_INPUT_IMPORTS,
    template: control('et-number-input'),
    field: 'input',
    fallback: null,
  },
  {
    name: 'et-password-input',
    imports: PASSWORD_INPUT_IMPORTS,
    template: control('et-password-input'),
    field: 'input',
    fallback: 'current-password',
  },
  {
    name: 'et-textarea',
    imports: TEXTAREA_IMPORTS,
    template: control('et-textarea'),
    field: 'textarea',
    fallback: null,
  },
  {
    name: 'et-date-input',
    imports: DATE_INPUT_IMPORTS,
    template: control('et-date-input'),
    field: '[etDateInputField]',
    fallback: 'off',
  },
  {
    name: 'et-time-input',
    imports: TIME_INPUT_IMPORTS,
    template: control('et-time-input'),
    field: '[etTimeInputField]',
    fallback: 'off',
  },
  {
    name: 'et-date-time-input',
    imports: DATE_TIME_INPUT_IMPORTS,
    template: control('et-date-time-input'),
    field: '[etDateTimeInputField]',
    fallback: 'off',
  },
  {
    name: 'et-date-range-input',
    imports: DATE_RANGE_INPUT_IMPORTS,
    template: control('et-date-range-input'),
    field: '[etDateRangeInputField]',
    fallback: 'off',
  },
  {
    name: 'et-time-range-input',
    imports: TIME_RANGE_INPUT_IMPORTS,
    template: control('et-time-range-input'),
    field: '[etTimeRangeInputField]',
    fallback: 'off',
  },
  {
    name: 'et-date-time-range-input',
    imports: DATE_TIME_RANGE_INPUT_IMPORTS,
    template: control('et-date-time-range-input'),
    field: '[etDateTimeRangeInputField]',
    fallback: 'off',
  },
  {
    name: 'et-duration-input',
    imports: DURATION_INPUT_IMPORTS,
    template: control('et-duration-input'),
    field: '[etDurationInputField]',
    fallback: 'off',
  },
  {
    name: 'et-tag-input',
    imports: TAG_INPUT_IMPORTS,
    template: control('et-tag-input'),
    field: '[etTagInputField]',
    fallback: 'off',
  },
  {
    name: 'et-phone-input',
    imports: PHONE_INPUT_IMPORTS,
    template: control('et-phone-input'),
    field: '[etPhoneInputField]',
    fallback: 'tel',
  },
  {
    name: 'et-select search',
    imports: SELECT_IMPORTS,
    template: (attr) =>
      `<et-select aria-label="Field"><input etSelectSearch ${attr} /><et-select-option value="a">A</et-select-option></et-select>`,
    field: '[etSelectSearch]',
    fallback: 'off',
  },
];

const render = (c: AutocompleteCase, attr: string) => {
  @Component({ imports: [...(c.imports as Type<unknown>[])], template: c.template(attr) })
  class AutocompleteHost {}

  const fixture = TestBed.createComponent(AutocompleteHost);
  fixture.detectChanges();
  const fields = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(c.field));
  expect(fields.length).toBeGreaterThan(0);

  return fields.map((field) => field.getAttribute('autocomplete'));
};

describe('autocomplete on text controls', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideColorThemes([...TEST_COLOR_THEMES])] }));

  describe.each(CASES)('$name', (c) => {
    it('renders its default autocomplete', () => {
      expect(new Set(render(c, ''))).toEqual(new Set([c.fallback]));
    });

    it('forwards the autocomplete input to its native field', () => {
      expect(new Set(render(c, 'autocomplete="bday"'))).toEqual(new Set(['bday']));
    });

    it('drops the attribute for an empty autocomplete', () => {
      expect(new Set(render(c, '[autocomplete]="\'\'"'))).toEqual(new Set([null]));
    });
  });
});
