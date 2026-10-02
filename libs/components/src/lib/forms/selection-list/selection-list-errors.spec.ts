import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { CheckboxOptionComponent } from './checkbox-group/checkbox-option.component';
import { RadioComponent } from './radio-group/radio.component';
import { SegmentedButtonComponent } from './segmented-button-group/segmented-button.component';
import { SELECTION_LIST_ERROR_CODES } from './selection-list-errors';
import { SELECTION_LIST_IMPORTS } from './selection-list.imports';

@Component({ template: `<et-radio value="a">A</et-radio>`, imports: [RadioComponent] })
class OrphanRadioTestHost {}

@Component({ template: `<et-checkbox-option value="a">A</et-checkbox-option>`, imports: [CheckboxOptionComponent] })
class OrphanCheckboxOptionTestHost {}

@Component({ template: `<et-segmented-button value="a">A</et-segmented-button>`, imports: [SegmentedButtonComponent] })
class OrphanSegmentedButtonTestHost {}

@Component({ template: `<div etSelectionOption value="a">A</div>`, imports: [SELECTION_LIST_IMPORTS] })
class BareSelectionOptionTestHost {}

describe('selection-list option errors', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });
  });

  it.each([
    [OrphanRadioTestHost, SELECTION_LIST_ERROR_CODES.RADIO_OUTSIDE_GROUP],
    [OrphanCheckboxOptionTestHost, SELECTION_LIST_ERROR_CODES.CHECKBOX_OPTION_OUTSIDE_GROUP],
    [OrphanSegmentedButtonTestHost, SELECTION_LIST_ERROR_CODES.SEGMENTED_BUTTON_OUTSIDE_GROUP],
  ])('rejects an option outside its group (%#)', (host, code) => {
    expect(() => TestBed.createComponent(host)).toThrow(`ET${code}`);
  });

  it('keeps the bare headless option usable on its own', () => {
    expect(() => TestBed.createComponent(BareSelectionOptionTestHost).detectChanges()).not.toThrow();
  });
});
