import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
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

// jsdom drops the component stylesheet whole (`@layer`, nesting), so the source text is the only
// place the rules are observable from a spec.
const readSheet = (file: string) => readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, file), 'utf8');

const CONTROLS = [
  'et-otp-input',
  'et-rating',
  'et-slider',
  'et-range-slider',
  'et-radio-group',
  'et-checkbox-group',
  'et-segmented-button-group',
  'et-dropzone',
] as const;

@Component({
  template: `
    <et-otp-input [(touched)]="touched" [errors]="errors" invalid name="otp">
      <et-label>Code</et-label>
      <et-hint>Six digits</et-hint>
    </et-otp-input>

    <et-rating [(touched)]="touched" [errors]="errors" invalid name="rating">
      <et-label>Rating</et-label>
      <et-hint>One to five stars</et-hint>
    </et-rating>

    <et-slider [(touched)]="touched" [errors]="errors" invalid name="slider">
      <et-label>Volume</et-label>
      <et-hint>Drag the thumb</et-hint>
    </et-slider>

    <et-range-slider [(touched)]="touched" [errors]="errors" invalid name="range">
      <et-label>Price</et-label>
      <et-hint>Set both ends</et-hint>
    </et-range-slider>

    <et-radio-group [(touched)]="touched" [errors]="errors" invalid name="radios">
      <et-label>Delivery</et-label>
      <et-radio value="a">A</et-radio>
      <et-hint>Pick one</et-hint>
    </et-radio-group>

    <et-checkbox-group [(touched)]="touched" [errors]="errors" invalid name="checkboxes">
      <et-label>Toppings</et-label>
      <et-checkbox-option value="a">A</et-checkbox-option>
      <et-hint>Pick any</et-hint>
    </et-checkbox-group>

    <et-segmented-button-group [(touched)]="touched" [errors]="errors" invalid name="segments">
      <et-label>View</et-label>
      <et-segmented-button value="a">A</et-segmented-button>
      <et-hint>Switch the layout</et-hint>
    </et-segmented-button-group>

    <et-dropzone [(touched)]="touched" [errors]="errors" [upload]="upload" invalid name="files">
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
class SupportDirectionTestHost {
  errors = [{ kind: 'required', message: 'Required' }];
  touched = signal(false);
  upload: AnyDropzoneUploadConfig<string> = {
    selectValue: (response: unknown) => String(response),
    createUploadHandle: () => {
      throw new Error('the support-direction spec never uploads');
    },
    deleteIncludesExisting: false,
  };
}

const mount = () => {
  TestBed.configureTestingModule({
    imports: [SupportDirectionTestHost],
    providers: [provideColorThemes(TEST_COLOR_THEMES)],
  });

  const fixture = TestBed.createComponent(SupportDirectionTestHost);

  fixture.detectChanges();

  const region = (control: string, kind: 'errors' | 'hint') =>
    fixture.nativeElement.querySelector(`${control} .et-form-support-${kind}`) as HTMLElement | null;

  return { fixture, region };
};

describe('support region severity direction', () => {
  it('enters the hint from above on every control that renders its own support region', () => {
    const { region } = mount();

    for (const control of CONTROLS) {
      const hint = region(control, 'hint');

      expect(hint, control).not.toBeNull();
      expect(hint?.getAttribute('data-direction'), control).toBe('from-above');
      expect(hint?.getAttribute('data-state'), control).toBe('active');
    }
  });

  it('brings a more severe error in from below and sends the hint out above', () => {
    const { fixture, region } = mount();

    fixture.componentInstance.touched.set(true);
    fixture.detectChanges();

    for (const control of CONTROLS) {
      expect(region(control, 'errors')?.getAttribute('data-direction'), control).toBe('from-below');
      expect(region(control, 'errors')?.getAttribute('data-state'), control).toBe('active');
      expect(region(control, 'hint')?.getAttribute('data-direction'), control).toBe('to-above');
      expect(region(control, 'hint')?.getAttribute('data-state'), control).toBe('leaving');
    }
  });

  it('brings the hint back from above and sends the resolved error out below', () => {
    const { fixture, region } = mount();

    fixture.componentInstance.touched.set(true);
    fixture.detectChanges();
    fixture.componentInstance.touched.set(false);
    fixture.detectChanges();

    for (const control of CONTROLS) {
      expect(region(control, 'hint')?.getAttribute('data-direction'), control).toBe('from-above');
      expect(region(control, 'hint')?.getAttribute('data-state'), control).toBe('active');
      expect(region(control, 'errors')?.getAttribute('data-direction'), control).toBe('to-below');
      expect(region(control, 'errors')?.getAttribute('data-state'), control).toBe('leaving');
    }
  });
});

describe('support region fade', () => {
  const shared = readSheet('form-support-styles.component.css');

  it('takes the leaving message out of flow', () => {
    expect(shared).toMatch(/&\[data-state='leaving'\] \{\s*position: absolute;\s*inset: 0;\s*pointer-events: none;/);
  });

  it('fades opacity only, without a slide', () => {
    expect(shared).toMatch(/transition: opacity var\(--et-form-support-duration\) ease;/);
    expect(shared).not.toMatch(/transform/);
  });

  it('leaves the form field on its direction slide', () => {
    const formField = readSheet('form-field.component.css');

    expect(formField).toMatch(/&\[data-state='leaving'\]\[data-direction='to-above'\]/);
    expect(formField).toMatch(/transform: translateY\(var\(--et-form-field-support-offset\)\);/);
  });
});
