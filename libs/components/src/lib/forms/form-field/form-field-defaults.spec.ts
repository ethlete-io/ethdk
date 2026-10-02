import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { InputDirective } from '../input/headless';
import { RadioGroupComponent } from '../selection-list/radio-group/radio-group.component';
import { provideFormFieldDefaults } from './form-field-defaults';
import { FormFieldComponent } from './form-field.component';
import { LabelDirective } from './headless';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';

@Component({
  selector: 'et-test-nested-defaults',
  template: `
    <et-form-field id="nested">
      <et-label>Nested</et-label>
      <input etInput />
    </et-form-field>
  `,
  imports: [FormFieldComponent, InputDirective, LabelDirective],
  providers: [provideFormFieldDefaults({ labelMode: 'inline' })],
})
class NestedDefaultsHost {}

@Component({
  template: `
    <et-form-field id="plain">
      <et-label>Plain</et-label>
      <input etInput />
    </et-form-field>
    <et-form-field id="overridden" appearance="box" fill="transparent" labelMode="static" size="md">
      <et-label>Overridden</et-label>
      <input etInput />
    </et-form-field>
    <et-radio-group id="group" aria-label="Group" />
    <et-test-nested-defaults />
  `,
  imports: [FormFieldComponent, InputDirective, LabelDirective, RadioGroupComponent, NestedDefaultsHost],
})
class DefaultsHost {}

const setup = (providers: unknown[] = []) => {
  TestBed.configureTestingModule({
    imports: [DefaultsHost],
    providers: [provideColorThemes([...TEST_COLOR_THEMES]), ...(providers as [])],
  });

  const fixture = TestBed.createComponent(DefaultsHost);
  fixture.detectChanges();

  const field = (id: string) => fixture.nativeElement.querySelector(`#${id}`) as HTMLElement;
  const look = (id: string) => ({
    appearance: field(id).getAttribute('data-appearance'),
    fill: field(id).getAttribute('data-fill'),
    labelMode: field(id).getAttribute('data-label-mode'),
    size: field(id).getAttribute('data-size'),
  });

  return { field, look };
};

describe('provideFormFieldDefaults', () => {
  it('keeps the built-in defaults when nothing is provided', () => {
    const { look } = setup();

    expect(look('plain')).toEqual({ appearance: 'box', fill: 'transparent', labelMode: 'static', size: 'md' });
  });

  it('applies the provided defaults to a field without inputs', () => {
    const { look } = setup([
      provideFormFieldDefaults({ appearance: 'underline', fill: 'filled', labelMode: 'floating-inside', size: 'lg' }),
    ]);

    expect(look('plain')).toEqual({
      appearance: 'underline',
      fill: 'filled',
      labelMode: 'floating-inside',
      size: 'lg',
    });
  });

  it('lets the inputs of a field win over the provided defaults', () => {
    const { look } = setup([
      provideFormFieldDefaults({ appearance: 'underline', fill: 'filled', labelMode: 'floating-inside', size: 'lg' }),
    ]);

    expect(look('overridden')).toEqual({ appearance: 'box', fill: 'transparent', labelMode: 'static', size: 'md' });
  });

  it('gives the selection groups the provided size', () => {
    const { field } = setup([provideFormFieldDefaults({ size: 'sm' })]);

    expect(field('group').getAttribute('data-size')).toBe('sm');
  });

  it('lets a nested provider replace the outer one, filling gaps from the built-in defaults', () => {
    const { look } = setup([provideFormFieldDefaults({ labelMode: 'floating-inside', size: 'lg' })]);

    expect(look('nested')).toEqual({ appearance: 'box', fill: 'transparent', labelMode: 'inline', size: 'md' });
  });
});
