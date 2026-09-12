import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { CHECKBOX_IMPORTS } from '../checkbox.imports';
import { expectDescribedByResolves } from '../../testing/described-by';
import { FORM_FIELD_IMPORTS } from '../../form-field/form-field.imports';
import { mountControl } from '../../../testing/control-driver';
import { FormFieldDirective, LabelDirective } from '../../form-field/headless';
import { CheckboxDriver, mountCheckbox } from '../../testing/checkbox-driver';
import { CheckboxDirective } from './checkbox.directive';

@Component({
  template: `
    <div etFormField>
      <div etCheckbox></div>
      <et-label>Accept terms</et-label>
    </div>
  `,
  imports: [CheckboxDirective, FormFieldDirective, LabelDirective],
})
class CheckboxInFormFieldTestHost {}

@Component({
  template: `<div etCheckbox></div>`,
  imports: [CheckboxDirective],
})
class StandaloneCheckboxTestHost {}

@Component({
  template: `<div [readonly]="readonly()" etCheckbox></div>`,
  imports: [CheckboxDirective],
})
class ReadonlyCheckboxTestHost {
  readonly = signal(true);
}

describe('CheckboxDirective', () => {
  describe('inside form field', () => {
    let driver: CheckboxDriver<CheckboxInFormFieldTestHost>;

    beforeEach(() => {
      driver = mountCheckbox(CheckboxInFormFieldTestHost);
    });

    it('should create', () => {
      expect(driver.checkboxEl()).toBeTruthy();
    });

    it('should have role checkbox', () => {
      expect(driver.attr('role')).toBe('checkbox');
    });

    it('should register with parent form field', () => {
      expect(driver.directive(FormFieldDirective).registeredControl()).toBeTruthy();
    });

    it('should compute labelId from registered label', () => {
      expect(driver.checkbox.labelId()).toMatch(/^et-label-\d+$/);
    });
  });

  describe('standalone', () => {
    let driver: CheckboxDriver<StandaloneCheckboxTestHost>;

    beforeEach(() => {
      driver = mountCheckbox(StandaloneCheckboxTestHost);
    });

    it('should create without a parent form field', () => {
      expect(driver.checkboxEl()).toBeTruthy();
    });

    it('should have aria-checked false by default', () => {
      expect(driver.attr('aria-checked')).toBe('false');
    });

    it('should toggle checked on click', () => {
      expect(driver.checkbox.checked()).toBe(false);

      driver.toggle();

      expect(driver.checkbox.checked()).toBe(true);
      expect(driver.attr('aria-checked')).toBe('true');
    });

    it('should toggle back to unchecked on second click', () => {
      driver.toggle();
      driver.toggle();

      expect(driver.checkbox.checked()).toBe(false);
    });

    it('should set touched on blur', () => {
      expect(driver.checkbox.touched()).toBe(false);

      driver.blur();

      expect(driver.checkbox.touched()).toBe(true);
    });

    it('should have tabindex 0 when not disabled', () => {
      expect(driver.attr('tabindex')).toBe('0');
    });
  });

  describe('readonly', () => {
    let driver: CheckboxDriver<ReadonlyCheckboxTestHost>;

    beforeEach(() => {
      driver = mountCheckbox(ReadonlyCheckboxTestHost);
    });

    it('blocks toggling but stays focusable with the normal look', () => {
      expect(driver.attr('aria-readonly')).toBe('true');
      expect(driver.attr('data-readonly')).toBe('true');
      // focusable and not dimmed - view-only, unlike disabled
      expect(driver.attr('tabindex')).toBe('0');
      expect(driver.attr('aria-disabled')).toBeNull();

      driver.toggle();

      expect(driver.checkbox.checked()).toBe(false);
    });

    it('toggles again once readonly is lifted', () => {
      driver.host.readonly.set(false);
      driver.tick();

      expect(driver.attr('aria-readonly')).toBeNull();

      driver.toggle();

      expect(driver.checkbox.checked()).toBe(true);
    });
  });
});

@Component({
  template: `
    <et-form-field>
      <et-label>Accept terms</et-label>
      <et-checkbox [(touched)]="touched" [errors]="errors" invalid name="terms" />
      <et-hint>You can withdraw consent later</et-hint>
    </et-form-field>
  `,
  imports: [FORM_FIELD_IMPORTS, CHECKBOX_IMPORTS],
})
class CheckboxWithErrorTestHost {
  errors = [{ kind: 'required', message: 'Accept the terms to continue' }];

  touched = signal(true);
}

describe('checkbox support region', () => {
  it('should describe the checkbox by the rendered error', () => {
    const host = mountControl(CheckboxWithErrorTestHost).nativeElement as HTMLElement;
    const error = host.querySelector('.et-form-field-errors')!;
    const described = Array.from(host.querySelectorAll('[aria-describedby]'));

    expect(described.length).toBeGreaterThan(0);

    for (const element of described) {
      expect(element.getAttribute('aria-describedby')).toBe(error.id);
      expectDescribedByResolves(element);
    }
  });
});
