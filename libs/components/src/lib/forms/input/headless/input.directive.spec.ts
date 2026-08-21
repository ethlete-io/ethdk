import { Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import '../../../../test-helpers';
import { FieldControlDriver, mountFieldControl } from '../../../testing/field-control-driver';
import { FormFieldDirective, LabelDirective } from '../../form-field/headless';
import { MASKED_INPUT_IMPORTS } from '../../masked-input/masked-input.imports';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { INPUT_IMPORTS } from '../input.imports';
import { InputDirective } from './input.directive';

@Component({
  template: `
    <div etFormField>
      <et-label>Email</et-label>
      <input etInput type="email" placeholder="test@example.com" />
    </div>
  `,
  imports: [InputDirective, FormFieldDirective, LabelDirective],
})
class InputInFormFieldTestHost {}

@Component({
  template: `<input etInput type="text" placeholder="standalone" />`,
  imports: [InputDirective],
})
class StandaloneInputTestHost {}

@Component({
  template: `
    <et-input
      [value]="value()"
      [mixed]="mixed()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      mixedLabel="Mixed values"
      placeholder="Type here"
    />
  `,
  imports: [INPUT_IMPORTS],
})
class MixedInputTestHost {
  value = signal('');
  mixed = signal(false);
}

@Component({
  template: `
    <et-input
      [value]="value()"
      [mixed]="mixed()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      etInputMask="00-00"
      mixedLabel="Mixed values"
    />
  `,
  imports: [INPUT_IMPORTS, MASKED_INPUT_IMPORTS],
})
class MixedMaskedInputTestHost {
  value = signal('');
  mixed = signal(false);
}

@Component({
  template: `<et-input aria-label="Search products" />`,
  imports: [INPUT_IMPORTS],
})
class AriaLabelInputTestHost {}

@Component({
  template: `<input [formField]="searchForm.search" etInput />`,
  imports: [InputDirective, FormField],
})
class NullableFieldTestHost {
  // A nullable string field, e.g. the query form's search field while it is empty.
  public model = signal<{ search: string | null }>({ search: null });
  public searchForm = form(this.model);
}

@Component({
  template: `
    <div etFormField>
      <et-label>Projected label</et-label>
      <et-input aria-labelledby="external-label-id" />
    </div>
  `,
  imports: [INPUT_IMPORTS, FormFieldDirective, LabelDirective],
})
class AriaLabelledbyOverrideTestHost {}

const mountInput = <T>(component: new () => T, directiveSelector?: string) =>
  mountFieldControl(component, InputDirective, { directiveSelector });

describe('InputDirective', () => {
  describe('accessible name forwarding', () => {
    it('forwards a consumer aria-label onto the native input', () => {
      const driver = mountInput(AriaLabelInputTestHost);

      expect(driver.field().getAttribute('aria-label')).toBe('Search products');
    });

    it('lets a consumer aria-labelledby override the projected label id', () => {
      const driver = mountInput(AriaLabelledbyOverrideTestHost, 'et-input');

      expect(driver.field().getAttribute('aria-labelledby')).toBe('external-label-id');
    });
  });

  describe('inside form field', () => {
    let driver: FieldControlDriver<InputInFormFieldTestHost, InputDirective>;

    beforeEach(() => {
      driver = mountInput(InputInFormFieldTestHost, '[etInput]');
    });

    it('should create', () => {
      expect(driver.field()).toBeTruthy();
    });

    it('should register with parent form field', () => {
      expect(driver.directive(FormFieldDirective).registeredControl()).toBeTruthy();
    });

    it('should compute labelId from registered label', () => {
      expect(driver.control.labelId()).toMatch(/^et-label-\d+$/);
    });

    it('should have null describedBy when no error or hint is present', () => {
      // describedBy is only set by the form field when there is an active error or hint
      expect(driver.control.describedBy()).toBeNull();
    });
  });

  describe('standalone', () => {
    let driver: FieldControlDriver<StandaloneInputTestHost, InputDirective>;

    beforeEach(() => {
      driver = mountInput(StandaloneInputTestHost);
    });

    it('should create without a parent form field', () => {
      expect(driver.field()).toBeTruthy();
    });

    it('should have null labelId without parent', () => {
      expect(driver.control.labelId()).toBeNull();
    });

    it('should have null describedBy without parent', () => {
      expect(driver.control.describedBy()).toBeNull();
    });
  });

  describe('value and state', () => {
    let driver: FieldControlDriver<StandaloneInputTestHost, InputDirective>;

    beforeEach(() => {
      driver = mountInput(StandaloneInputTestHost);
    });

    it('should have empty value by default', () => {
      expect(driver.control.value()).toBe('');
    });

    it('should not display error when not touched', () => {
      expect(driver.control.shouldDisplayError()).toBe(false);
    });

    it('should have text type by default', () => {
      expect(driver.control.type()).toBe('text');
    });
  });

  describe('nullable bound field', () => {
    let driver: FieldControlDriver<NullableFieldTestHost, InputDirective>;

    beforeEach(() => {
      driver = mountInput(NullableFieldTestHost);
    });

    it('reads a null value as empty', () => {
      expect(driver.control.hasValue()).toBe(false);
      expect(driver.control.displayValue()).toBe('');
    });

    it('reports a value once the field holds text', () => {
      driver.host.model.set({ search: 'angular' });
      driver.tick();

      expect(driver.control.hasValue()).toBe(true);
      expect(driver.control.displayValue()).toBe('angular');
    });
  });

  describe('mixed state', () => {
    const setup = () => {
      const driver = mountInput(MixedInputTestHost);

      return {
        driver,
        enterMixed: (rawValue: string) => {
          driver.host.value.set(rawValue);
          driver.host.mixed.set(true);
          driver.tick();
        },
      };
    };

    describeMixedStateContract(() => {
      const { driver, enterMixed } = setup();

      return {
        enterMixed: () => enterMixed('hidden raw'),
        rawValue: () => 'hidden raw',
        value: () => driver.host.value(),
        mixed: () => driver.host.mixed(),
        hostElement: () => driver.element(),
        writeValueExternally: () => {
          driver.host.value.set('server write');
          driver.tick();
        },
        externallyWrittenValue: () => 'server write',
        commit: () => driver.type('typed over'),
        committedValue: () => 'typed over',
        assertMasked: () => {
          expect(driver.fieldValue()).toBe('');
          expect(driver.placeholder()).toBe('Mixed values');
        },
      };
    });

    it('masks via the placeholder and restores the consumer placeholder after the commit', () => {
      const { driver, enterMixed } = setup();

      enterMixed('secret');

      expect(driver.fieldValue()).toBe('');
      expect(driver.placeholder()).toBe('Mixed values');

      driver.type('new text');

      expect(driver.fieldValue()).toBe('new text');
      expect(driver.placeholder()).toBe('Type here');
    });

    it('keeps mixed and the raw value when an edit produces no content', () => {
      const { driver, enterMixed } = setup();

      enterMixed('secret');
      driver.type('');

      expect(driver.host.mixed()).toBe(true);
      expect(driver.host.value()).toBe('secret');
      expect(driver.placeholder()).toBe('Mixed values');
    });

    it('keeps an input mask from repainting the hidden raw value and commits typed content through it', async () => {
      const driver = mountInput(MixedMaskedInputTestHost);

      await driver.fixture.whenStable();

      driver.host.value.set('1234');
      driver.host.mixed.set(true);
      driver.tick();
      await driver.fixture.whenStable();

      // the mask's display enforcement must not leak the masked raw value into the DOM
      expect(driver.fieldValue()).toBe('');
      expect(driver.placeholder()).toBe('Mixed values');
      expect(driver.host.value()).toBe('1234');

      driver.field().value = '5';
      driver.field().setSelectionRange(1, 1);
      driver.field().dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      driver.tick();
      await driver.fixture.whenStable();

      // replace semantics: the commit starts from an empty committed raw, not the hidden '1234'
      expect(driver.host.mixed()).toBe(false);
      expect(driver.host.value()).toBe('5');
      expect(driver.fieldValue()).toBe('5');
    });

    it('exposes data-mixed on a standalone headless input host', () => {
      const driver = mountInput(StandaloneInputTestHost);

      driver.control.mixed.set(true);
      driver.tick();

      expect(driver.field().getAttribute('data-mixed')).toBe('true');
      expect(driver.control.hasValue()).toBe(true);
    });
  });
});
