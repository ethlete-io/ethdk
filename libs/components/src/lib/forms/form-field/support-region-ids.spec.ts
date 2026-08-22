import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { expectDescribedByResolves } from '../testing/described-by';
import { DROPZONE_IMPORTS } from '../dropzone/dropzone.imports';
import { AnyDropzoneUploadConfig } from '../dropzone/headless/dropzone-upload';
import { OTP_INPUT_IMPORTS } from '../otp-input/otp-input.imports';
import { RATING_IMPORTS } from '../rating/rating.imports';
import {
  CHECKBOX_GROUP_IMPORTS,
  RADIO_GROUP_IMPORTS,
  SEGMENTED_BUTTON_IMPORTS,
} from '../selection-list/selection-list.imports';
import { SLIDER_IMPORTS } from '../slider/slider.imports';
import { HintComponent } from './hint.component';
import { LabelDirective } from './headless';

@Component({
  template: `
    <et-otp-input name="otp">
      <et-label>Code</et-label>
      <et-hint>Six digits from the email</et-hint>
    </et-otp-input>

    <et-rating name="rating">
      <et-label>Rating</et-label>
      <et-hint>One to five stars</et-hint>
    </et-rating>

    <et-slider name="slider">
      <et-label>Volume</et-label>
      <et-hint>Drag or use the arrow keys</et-hint>
    </et-slider>

    <et-range-slider name="range">
      <et-label>Price</et-label>
      <et-hint>Set both ends</et-hint>
    </et-range-slider>

    <et-radio-group [(touched)]="touched" [errors]="errors" invalid name="radios">
      <et-label>Delivery</et-label>
      <et-radio value="a">A</et-radio>
      <et-hint>Pick exactly one</et-hint>
    </et-radio-group>

    <et-checkbox-group name="checkboxes">
      <et-label>Toppings</et-label>
      <et-checkbox-option value="a">A</et-checkbox-option>
      <et-hint>Pick any number</et-hint>
    </et-checkbox-group>

    <et-segmented-button-group name="segments">
      <et-label>View</et-label>
      <et-segmented-button value="a">A</et-segmented-button>
      <et-hint>Switch the layout</et-hint>
    </et-segmented-button-group>

    <et-dropzone [upload]="upload" name="files">
      <et-label>Attachments</et-label>
      <et-hint>Images up to 5 MB</et-hint>
    </et-dropzone>
  `,
  imports: [
    OTP_INPUT_IMPORTS,
    RATING_IMPORTS,
    SLIDER_IMPORTS,
    RADIO_GROUP_IMPORTS,
    CHECKBOX_GROUP_IMPORTS,
    SEGMENTED_BUTTON_IMPORTS,
    DROPZONE_IMPORTS,
    HintComponent,
    LabelDirective,
  ],
})
class SupportRegionTestHost {
  errors = [{ kind: 'required', message: 'Pick a delivery option' }];
  touched = signal(true);
  // nothing here uploads - the dropzone only needs its required input to be readable
  upload: AnyDropzoneUploadConfig<string> = {
    selectValue: (response: unknown) => String(response),
    createUploadHandle: () => {
      throw new Error('the support-region spec never uploads');
    },
    deleteIncludesExisting: false,
  };
}

/**
 * Every control that renders its own support region has to put the form field's ids on it. The
 * shared `aria-describedby` machinery names those ids blind - nothing else notices when the
 * element they point at does not exist, and the hint or error simply goes unannounced.
 */
describe('support region ids', () => {
  it('resolves aria-describedby on every control that renders its own support region', () => {
    TestBed.configureTestingModule({
      imports: [SupportRegionTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });

    const fixture = TestBed.createComponent(SupportRegionTestHost);

    fixture.detectChanges();

    const described = Array.from(fixture.nativeElement.querySelectorAll('[aria-describedby]'));

    expect(described.length).toBeGreaterThanOrEqual(8);

    for (const element of described) {
      expectDescribedByResolves(element as Element);
    }
  });

  it('points a touched, invalid group at its rendered error rather than its hint', () => {
    TestBed.configureTestingModule({
      imports: [SupportRegionTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });

    const fixture = TestBed.createComponent(SupportRegionTestHost);

    fixture.detectChanges();

    const group = fixture.nativeElement.querySelector('et-radio-group[aria-describedby]') as Element;

    expect(group.getAttribute('aria-describedby')).toBe('et-form-field-error-radios');
    expectDescribedByResolves(group);
    expect(fixture.nativeElement.querySelector('#et-form-field-error-radios')?.textContent).toContain(
      'Pick a delivery option',
    );
  });
});
