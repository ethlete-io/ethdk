import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, hidden } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { CHECKBOX_IMPORTS } from '../checkbox/checkbox.imports';
import { CHOICE_FIELD_IMPORTS } from '../choice-field/choice-field.imports';
import { OTP_INPUT_IMPORTS } from '../otp-input/otp-input.imports';
import { RATING_IMPORTS } from '../rating/rating.imports';
import { SLIDER_IMPORTS } from '../slider/slider.imports';
import { SWITCH_IMPORTS } from '../switch/switch.imports';
import { CascaderComponent } from '../cascader/cascader.component';
import { DateInputComponent } from '../date-time/date-input/date-input.component';
import { DateRangeInputComponent } from '../date-time/date-range-input/date-range-input.component';
import { DateTimeInputComponent } from '../date-time/date-time-input/date-time-input.component';
import { DateTimeRangeInputComponent } from '../date-time/date-time-range-input/date-time-range-input.component';
import { DurationInputComponent } from '../date-time/duration-input/duration-input.component';
import { TimeInputComponent } from '../date-time/time-input/time-input.component';
import { TimeRangeInputComponent } from '../date-time/time-range-input/time-range-input.component';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';
import { SelectComponent } from '../select/select.component';
import { SELECT_IMPORTS } from '../select/select.imports';
import { CheckboxGroupComponent } from '../selection-list/checkbox-group/checkbox-group.component';
import { RadioGroupComponent } from '../selection-list/radio-group/radio-group.component';
import { SegmentedButtonGroupComponent } from '../selection-list/segmented-button-group/segmented-button-group.component';
import {
  CHECKBOX_GROUP_IMPORTS,
  RADIO_GROUP_IMPORTS,
  SEGMENTED_BUTTON_IMPORTS,
} from '../selection-list/selection-list.imports';
import { TagInputComponent } from '../tag-input/tag-input.component';
import { TAG_INPUT_IMPORTS } from '../tag-input/tag-input.imports';
import { expectWrapperExposesBaseInputs } from '../testing/wrapper-inputs';
import { FORM_FIELD_IMPORTS } from './form-field.imports';
import { FIELD_STATE_INPUTS } from './headless/field-state-control.directive';

@Component({
  template: `
    <et-rating [formField]="demoForm.rating" aria-label="Rating" />
    <et-slider [formField]="demoForm.volume" aria-label="Volume" />
    <et-otp-input [formField]="demoForm.code" aria-label="Code" />
    <et-choice-field>
      <et-checkbox [formField]="demoForm.terms" />
      <et-label>Terms</et-label>
    </et-choice-field>
  `,
  imports: [RATING_IMPORTS, SLIDER_IMPORTS, OTP_INPUT_IMPORTS, CHECKBOX_IMPORTS, CHOICE_FIELD_IMPORTS, FormField],
})
class SchemaHiddenTestHost {
  hide = signal(false);
  model = signal({ rating: null as number | null, volume: 10, code: '', terms: false });
  demoForm = form(this.model, (s) => {
    hidden(s.rating, () => this.hide());
    hidden(s.volume, () => this.hide());
    hidden(s.code, () => this.hide());
    hidden(s.terms, () => this.hide());
  });
}

@Component({
  template: `
    <et-rating warnings="Rating advisory" aria-label="Rating" />
    <et-range-slider warnings="Range advisory" />
    <et-otp-input hidden aria-label="Code" />
    <et-choice-field class="checkbox-field">
      <et-checkbox warnings="Checkbox advisory" />
      <et-label>Terms</et-label>
    </et-choice-field>
    <et-choice-field class="switch-field">
      <et-switch hidden />
      <et-label>Notify</et-label>
    </et-choice-field>
  `,
  imports: [RATING_IMPORTS, SLIDER_IMPORTS, OTP_INPUT_IMPORTS, CHECKBOX_IMPORTS, SWITCH_IMPORTS, CHOICE_FIELD_IMPORTS],
})
class UnboundStateTestHost {}

@Component({
  template: `
    <et-form-field class="select-field">
      <et-label>Plan</et-label>
      <et-select [formField]="demoForm.plan">
        <et-select-option value="free">Free</et-select-option>
      </et-select>
    </et-form-field>
    <et-form-field class="tags-field">
      <et-label>Tags</et-label>
      <et-tag-input [formField]="demoForm.tags" />
    </et-form-field>
    <et-radio-group [formField]="demoForm.size" aria-label="Size">
      <et-radio value="s">S</et-radio>
    </et-radio-group>
  `,
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS, TAG_INPUT_IMPORTS, RADIO_GROUP_IMPORTS, FormField],
})
class SchemaHiddenFieldTestHost {
  hide = signal(false);
  model = signal({ plan: 'free', tags: [] as string[], size: 's' });
  demoForm = form(this.model, (s) => {
    hidden(s.plan, () => this.hide());
    hidden(s.tags, () => this.hide());
    hidden(s.size, () => this.hide());
  });
}

@Component({
  template: `
    <et-form-field class="select-field">
      <et-label>Plan</et-label>
      <et-select warnings="Select advisory">
        <et-select-option value="free">Free</et-select-option>
      </et-select>
    </et-form-field>
    <et-form-field class="tags-field">
      <et-label>Tags</et-label>
      <et-tag-input warnings="Tags advisory" />
    </et-form-field>
    <et-checkbox-group warnings="Group advisory" aria-label="Add-ons">
      <et-checkbox-option value="stats">Stats</et-checkbox-option>
    </et-checkbox-group>
    <et-segmented-button-group hidden aria-label="View">
      <et-segmented-button value="list">List</et-segmented-button>
    </et-segmented-button-group>
  `,
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS, TAG_INPUT_IMPORTS, CHECKBOX_GROUP_IMPORTS, SEGMENTED_BUTTON_IMPORTS],
})
class UnboundFieldStateTestHost {}

const FIELD_STATE_WRAPPERS = [
  { selector: 'et-select', component: SelectComponent },
  { selector: 'et-cascader', component: CascaderComponent },
  { selector: 'et-tag-input', component: TagInputComponent },
  { selector: 'et-date-input', component: DateInputComponent },
  { selector: 'et-time-input', component: TimeInputComponent },
  { selector: 'et-date-time-input', component: DateTimeInputComponent },
  { selector: 'et-date-range-input', component: DateRangeInputComponent },
  { selector: 'et-time-range-input', component: TimeRangeInputComponent },
  { selector: 'et-date-time-range-input', component: DateTimeRangeInputComponent },
  { selector: 'et-duration-input', component: DurationInputComponent },
  { selector: 'et-radio-group', component: RadioGroupComponent },
  { selector: 'et-checkbox-group', component: CheckboxGroupComponent },
  { selector: 'et-segmented-button-group', component: SegmentedButtonGroupComponent },
  { selector: 'et-rich-text-editor', component: RichTextEditorComponent },
];

const mount = <T>(host: new () => T) => {
  TestBed.configureTestingModule({ imports: [host], providers: [provideColorThemes(TEST_COLOR_THEMES)] });

  const fixture = TestBed.createComponent(host);

  fixture.detectChanges();

  return fixture;
};

describe('self-hosted control field state', () => {
  it('hides each control while its schema hidden() rule holds', () => {
    const fixture = mount(SchemaHiddenTestHost);
    const host = fixture.nativeElement as HTMLElement;
    const display = (selector: string) => (host.querySelector(selector) as HTMLElement).style.display;

    const selectors = ['et-rating', 'et-slider', 'et-otp-input', 'et-choice-field'];

    expect(selectors.map(display)).toEqual(['', '', '', '']);

    fixture.componentInstance.hide.set(true);
    fixture.detectChanges();

    expect(selectors.map(display)).toEqual(['none', 'none', 'none', 'none']);
  });

  it('takes warnings and hidden as plain inputs on an unbound control', async () => {
    const fixture = mount(UnboundStateTestHost);

    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('et-rating')?.textContent).toContain('Rating advisory');
    expect(host.querySelector('et-range-slider')?.textContent).toContain('Range advisory');
    expect((host.querySelector('et-otp-input') as HTMLElement).style.display).toBe('none');
    expect(host.querySelector('.checkbox-field')?.textContent).toContain('Checkbox advisory');
    expect((host.querySelector('.switch-field') as HTMLElement).style.display).toBe('none');
  });

  it('hides the form field around a select or tag input, and a selection group, while hidden() holds', () => {
    const fixture = mount(SchemaHiddenFieldTestHost);
    const host = fixture.nativeElement as HTMLElement;
    const display = (selector: string) => (host.querySelector(selector) as HTMLElement).style.display;
    const selectors = ['.select-field', '.tags-field', 'et-radio-group'];

    expect(selectors.map(display)).toEqual(['', '', '']);

    fixture.componentInstance.hide.set(true);
    fixture.detectChanges();

    expect(selectors.map(display)).toEqual(['none', 'none', 'none']);
  });

  it('takes warnings and hidden as plain inputs on an unbound select, tag input and selection group', async () => {
    const fixture = mount(UnboundFieldStateTestHost);

    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.select-field')?.textContent).toContain('Select advisory');
    expect(host.querySelector('.tags-field')?.textContent).toContain('Tags advisory');
    expect(host.querySelector('et-checkbox-group')?.textContent).toContain('Group advisory');
    expect((host.querySelector('et-segmented-button-group') as HTMLElement).style.display).toBe('none');
  });
});

describe('field state wrappers', () => {
  for (const wrapper of FIELD_STATE_WRAPPERS) {
    it(`${wrapper.selector} exposes hidden and warnings`, () => {
      TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });

      expectWrapperExposesBaseInputs(wrapper, FIELD_STATE_INPUTS);
    });
  }
});
