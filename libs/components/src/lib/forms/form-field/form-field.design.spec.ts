import { Component, input as signalInput, signal, OnInit } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { disabled, form, FormField, readonly, required } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import { formField, FormFieldMockOptions, input, InputMockOptions } from '../../../../design/form-field';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { mockShapeOf, shapeOf } from '../../testing/design-mock-shape';
import { INPUT_IMPORTS } from '../input';
import { FORM_FIELD_IMPORTS } from './form-field.imports';
import { FormFieldAppearance, FormFieldFill, FormFieldLabelMode, FormFieldSize } from './form-field.variants';

@Component({
  imports: [FORM_FIELD_IMPORTS, INPUT_IMPORTS, FormField],
  template: `
    <et-form-field [appearance]="appearance()" [fill]="fill()" [labelMode]="labelMode()" [size]="size()">
      @if (label()) {
        <et-label>{{ label() }}</et-label>
      }
      <et-input [formField]="fields.name" [placeholder]="placeholder()" />
      @if (hint()) {
        <et-hint>{{ hint() }}</et-hint>
      }
    </et-form-field>
  `,
})
class FormFieldHost implements OnInit {
  public appearance = signalInput<FormFieldAppearance>('box');
  public fill = signalInput<FormFieldFill>('transparent');
  public labelMode = signalInput<FormFieldLabelMode>('static');
  public size = signalInput<FormFieldSize>('md');
  public label = signalInput<string | undefined>(undefined);
  public hint = signalInput<string | undefined>(undefined);
  public placeholder = signalInput('');
  public value = signalInput('');
  public isRequired = signalInput(false);
  public isDisabled = signalInput(false);
  public isReadonly = signalInput(false);

  protected model = signal({ name: '' });
  public fields = form(this.model, (path) => {
    required(path.name, { when: () => this.isRequired() });
    disabled(path.name, () => this.isDisabled());
    readonly(path.name, () => this.isReadonly());
  });

  public ngOnInit() {
    this.model.set({ name: this.value() });
  }
}

type Case = { field: Omit<FormFieldMockOptions, 'control'>; input: InputMockOptions; touched?: boolean };

const CASES: Case[] = [
  { field: { label: 'Name', hint: 'Shown on your profile', errorColor: 'red' }, input: { placeholder: 'Your name' } },
  {
    field: { label: 'Name', required: true, error: 'This field is required', errorColor: 'red' },
    input: {},
    touched: true,
  },
  { field: { label: 'Name', labelMode: 'floating-inside', size: 'sm', disabled: true }, input: { value: 'Ada' } },
  { field: { appearance: 'underline', fill: 'filled', readonly: true, labelMode: 'inline' }, input: { value: 'Ada' } },
  { field: { label: 'Name', labelMode: 'floating-outside', size: 'lg' }, input: { placeholder: 'Your name' } },
];

describe('form field design mock', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });
  });

  it.each(CASES)('draws the classes the component renders for %o', async (testCase) => {
    const fixture = TestBed.createComponent(FormFieldHost);
    const { field } = testCase;

    const inputs = {
      appearance: field.appearance,
      fill: field.fill,
      labelMode: field.labelMode,
      size: field.size,
      label: field.label,
      hint: field.hint,
      placeholder: testCase.input.placeholder,
      value: testCase.input.value,
      isRequired: field.required,
      isDisabled: field.disabled,
      isReadonly: field.readonly,
    };

    for (const [name, value] of Object.entries(inputs)) {
      if (value !== undefined) fixture.componentRef.setInput(name, value);
    }

    fixture.detectChanges();

    if (testCase.touched) fixture.componentInstance.fields.name().markAsTouched();

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const real = fixture.nativeElement.querySelector('et-form-field');
    const drawn = formField({ ...field, control: input(testCase.input) });

    expect(mockShapeOf(drawn, 'et-form-field')).toEqual(shapeOf(real));
  });
});
