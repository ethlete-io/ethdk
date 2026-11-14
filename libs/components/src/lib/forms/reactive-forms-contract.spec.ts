import { Component, signal, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormsModule, NgModel, ReactiveFormsModule, RequiredValidator, Validators } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { provideColorThemes } from '@ethlete/core';
import '../../test-helpers';
import { TEST_COLOR_THEMES } from '../testing/color-themes';
import { CHECKBOX_IMPORTS, CheckboxDirective } from './checkbox';
import { CHOICE_FIELD_IMPORTS } from './choice-field';
import { DATE_INPUT_IMPORTS, DateInputDirective, TIME_INPUT_IMPORTS, TimeInputDirective } from './date-time';
import { FORM_ERROR_MESSAGE_RESOLVER, FORM_FIELD_IMPORTS } from './form-field';
import {
  INPUT_IMPORTS,
  InputDirective,
  NUMBER_INPUT_IMPORTS,
  NumberInputDirective,
  PASSWORD_INPUT_IMPORTS,
  PasswordInputDirective,
} from './input';
import { SELECT_IMPORTS, SelectDirective } from './select';
import { RADIO_GROUP_IMPORTS, SEGMENTED_BUTTON_IMPORTS, SelectionListDirective } from './selection-list';
import { SWITCH_IMPORTS, SwitchDirective } from './switch';
import { TEXTAREA_IMPORTS, TextareaDirective } from './textarea';

type ControlCase = {
  name: string;
  imports: readonly unknown[];
  template: string;
  dir: Type<unknown>;
  model: 'value' | 'checked';
  a: unknown;
  b: unknown;
  empty: unknown;
  requiredTrue?: boolean;
};

const field = (control: string) => `<et-form-field><et-label>Field</et-label>${control}</et-form-field>`;
const choice = (control: string) => `<et-choice-field>${control}<et-label>Accept</et-label></et-choice-field>`;

const CASES: ControlCase[] = [
  {
    name: 'et-input',
    imports: [FORM_FIELD_IMPORTS, INPUT_IMPORTS],
    template: field(`<et-input BIND REQ />`),
    dir: InputDirective,
    model: 'value',
    a: 'alpha',
    b: 'beta',
    empty: '',
  },
  {
    name: 'et-number-input',
    imports: [FORM_FIELD_IMPORTS, NUMBER_INPUT_IMPORTS],
    template: field(`<et-number-input BIND REQ />`),
    dir: NumberInputDirective,
    model: 'value',
    a: 3,
    b: 7,
    empty: null,
  },
  {
    name: 'et-password-input',
    imports: [FORM_FIELD_IMPORTS, PASSWORD_INPUT_IMPORTS],
    template: field(`<et-password-input BIND REQ />`),
    dir: PasswordInputDirective,
    model: 'value',
    a: 'secret-a',
    b: 'secret-b',
    empty: '',
  },
  {
    name: 'et-textarea',
    imports: [FORM_FIELD_IMPORTS, TEXTAREA_IMPORTS],
    template: field(`<et-textarea BIND REQ />`),
    dir: TextareaDirective,
    model: 'value',
    a: 'alpha',
    b: 'beta',
    empty: '',
  },
  {
    name: 'et-select',
    imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS],
    template: field(
      `<et-select BIND REQ><et-select-option value="a">A</et-select-option><et-select-option value="b">B</et-select-option></et-select>`,
    ),
    dir: SelectDirective,
    model: 'value',
    a: 'a',
    b: 'b',
    empty: null,
  },
  {
    name: 'et-time-input',
    imports: [FORM_FIELD_IMPORTS, TIME_INPUT_IMPORTS],
    template: field(`<et-time-input BIND REQ />`),
    dir: TimeInputDirective,
    model: 'value',
    a: '10:30',
    b: '12:45',
    empty: null,
  },
  {
    name: 'et-date-input',
    imports: [FORM_FIELD_IMPORTS, DATE_INPUT_IMPORTS],
    template: field(`<et-date-input BIND REQ />`),
    dir: DateInputDirective,
    model: 'value',
    a: '2026-01-02',
    b: '2026-03-04',
    empty: null,
  },
  {
    name: 'et-checkbox',
    imports: [CHOICE_FIELD_IMPORTS, CHECKBOX_IMPORTS],
    template: choice(`<et-checkbox BIND REQ />`),
    dir: CheckboxDirective,
    model: 'checked',
    a: true,
    b: false,
    empty: false,
    requiredTrue: true,
  },
  {
    name: 'et-switch',
    imports: [CHOICE_FIELD_IMPORTS, SWITCH_IMPORTS],
    template: choice(`<et-switch BIND REQ />`),
    dir: SwitchDirective,
    model: 'checked',
    a: true,
    b: false,
    empty: false,
    requiredTrue: true,
  },
  {
    name: 'et-radio-group',
    imports: [FORM_FIELD_IMPORTS, RADIO_GROUP_IMPORTS],
    template: field(
      `<et-radio-group BIND REQ><et-radio value="a">A</et-radio><et-radio value="b">B</et-radio></et-radio-group>`,
    ),
    dir: SelectionListDirective,
    model: 'value',
    a: 'a',
    b: 'b',
    empty: null,
  },
  {
    name: 'et-segmented-button-group',
    imports: [FORM_FIELD_IMPORTS, SEGMENTED_BUTTON_IMPORTS],
    template: field(
      `<et-segmented-button-group BIND REQ><et-segmented-button value="a">A</et-segmented-button><et-segmented-button value="b">B</et-segmented-button></et-segmented-button-group>`,
    ),
    dir: SelectionListDirective,
    model: 'value',
    a: 'a',
    b: 'b',
    empty: null,
  },
];

const REQUIRED_TEXT = 'This field is required';

type Probe = Record<string, (() => unknown) & { set?: (v: unknown) => void }>;

type Validation = 'validators' | 'template-required' | 'none';

const reactiveHost = (c: ControlCase, validation: Validation, validators?: unknown[]) => {
  const fallback = c.requiredTrue ? [Validators.requiredTrue] : [Validators.required];

  @Component({
    imports: [ReactiveFormsModule, ...(c.imports as Type<unknown>[])],
    template: c.template
      .replace('BIND', '[formControl]="ctrl"')
      .replace('REQ', validation === 'template-required' ? 'required' : ''),
  })
  class ReactiveHost {
    public ctrl = new FormControl<unknown>(c.a, validation === 'validators' ? ((validators ?? fallback) as never) : []);
  }

  return ReactiveHost;
};

const settle = async (fixture: ComponentFixture<unknown>) => {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
};

const mountReactive = async (c: ControlCase, validation: Validation = 'validators', validators?: unknown[]) => {
  const fixture = TestBed.createComponent(reactiveHost(c, validation, validators)) as ComponentFixture<{
    ctrl: FormControl;
  }>;
  await settle(fixture);
  const de = fixture.debugElement.query(By.directive(c.dir));

  return {
    fixture,
    ctrl: fixture.componentInstance.ctrl,
    dir: de.injector.get(c.dir) as Probe,
    el: de.nativeElement as HTMLElement,
  };
};

const blur = (el: HTMLElement) => {
  const target = el.matches('input,textarea') ? el : (el.querySelector<HTMLElement>('input,textarea,[tabindex]') ?? el);
  target.dispatchEvent(new FocusEvent('focus'));
  target.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  target.dispatchEvent(new FocusEvent('blur'));
  target.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
};

const caseNamed = (name: string) => CASES.find((c) => c.name === name)!;

describe('reactive forms on et-* form controls', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideColorThemes([...TEST_COLOR_THEMES])] }));

  describe.each(CASES)('[formControl] on $name', (c) => {
    it('writes the FormControl value and setValue into the control', async () => {
      const { fixture, ctrl, dir } = await mountReactive(c);
      expect(dir[c.model]!()).toEqual(c.a);

      ctrl.setValue(c.b);
      await settle(fixture);
      expect(dir[c.model]!()).toEqual(c.b);
    });

    it('reads a control change back into value, valueChanges and dirty', async () => {
      const { fixture, ctrl, dir } = await mountReactive(c);
      const seen: unknown[] = [];
      ctrl.valueChanges.subscribe((v) => seen.push(v));

      dir[c.model]!.set!(c.b);
      await settle(fixture);
      expect({ value: ctrl.value, seen, dirty: ctrl.dirty }).toEqual({ value: c.b, seen: [c.b], dirty: true });
    });

    it('follows disable() and enable()', async () => {
      const { fixture, ctrl, dir } = await mountReactive(c);
      ctrl.disable();
      await settle(fixture);
      expect(dir['disabled']!()).toBe(true);

      ctrl.enable();
      await settle(fixture);
      expect(dir['disabled']!()).toBe(false);
    });

    it('marks touched on blur and follows markAsTouched / markAsUntouched', async () => {
      const { fixture, ctrl, dir, el } = await mountReactive(c);
      blur(el);
      await settle(fixture);
      expect(ctrl.touched).toBe(true);

      ctrl.markAsUntouched();
      await settle(fixture);
      expect(dir['touched']!()).toBe(false);

      ctrl.markAsTouched();
      await settle(fixture);
      expect(dir['touched']!()).toBe(true);
    });

    it('passes the required error and shows the SDK message once touched', async () => {
      const { fixture, ctrl, dir } = await mountReactive(c);
      ctrl.setValue(c.empty);
      ctrl.markAsTouched();
      await settle(fixture);

      expect(dir['invalid']!()).toBe(true);
      expect((dir['errors']!() as { kind: string }[]).map((e) => e.kind)).toEqual(['required']);
      expect(fixture.nativeElement.textContent).toContain(REQUIRED_TEXT);
    });

    if (c.requiredTrue) {
      it('KNOWN GAP: Validators.requiredTrue alone does not set required', async () => {
        const { dir } = await mountReactive(c);
        expect(dir['required']!()).toBe(false);
      });

      it('sets required with Validators.required beside requiredTrue, and the error still comes from requiredTrue', async () => {
        const { fixture, ctrl, dir } = await mountReactive(c, 'validators', [
          Validators.required,
          Validators.requiredTrue,
        ]);
        expect(dir['required']!()).toBe(true);

        ctrl.setValue(false);
        await settle(fixture);
        expect(ctrl.errors).toEqual({ required: true });
      });
    } else {
      it('sets required from Validators.required', async () => {
        const { dir } = await mountReactive(c);
        expect(dir['required']!()).toBe(true);
      });
    }

    it('KNOWN GAP: a template required beside [formControl] switches itself off', async () => {
      const { fixture, ctrl, dir } = await mountReactive(c, 'template-required');
      ctrl.setValue(c.empty);
      await settle(fixture);
      const validator = fixture.debugElement.query(By.directive(RequiredValidator)).injector.get(RequiredValidator);

      expect({
        sdkRequired: dir['required']!(),
        validatorInput: validator.required,
        error: ctrl.hasError('required'),
      }).toEqual({ sdkRequired: false, validatorInput: false, error: false });
    });

    it('reset() restores the value and the untouched, pristine state', async () => {
      const { fixture, ctrl, dir } = await mountReactive(c);
      dir[c.model]!.set!(c.b);
      ctrl.markAsTouched();
      await settle(fixture);

      ctrl.reset(c.a);
      await settle(fixture);
      expect({ value: dir[c.model]!(), touched: dir['touched']!(), pristine: ctrl.pristine }).toEqual({
        value: c.a,
        touched: false,
        pristine: true,
      });
    });
  });

  describe.each(CASES)('[(ngModel)] on $name', (c) => {
    const ngModelHost = (required: boolean) => {
      @Component({
        imports: [FormsModule, ...(c.imports as Type<unknown>[])],
        template: c.template
          .replace('BIND', '[(ngModel)]="model" [disabled]="locked()"')
          .replace('REQ', required ? 'required' : ''),
      })
      class NgModelHost {
        public model = signal<unknown>(c.a);
        public locked = signal(false);
      }

      return NgModelHost;
    };

    const mount = async (required = false) => {
      const fixture = TestBed.createComponent(ngModelHost(required)) as ComponentFixture<{
        model: ReturnType<typeof signal<unknown>>;
        locked: ReturnType<typeof signal<boolean>>;
      }>;
      await settle(fixture);
      const de = fixture.debugElement.query(By.directive(c.dir));

      return {
        fixture,
        host: fixture.componentInstance,
        dir: de.injector.get(c.dir) as Probe,
        ngModel: de.injector.get(NgModel),
      };
    };

    it('writes the model into the control and reads a control change back', async () => {
      const { fixture, host, dir } = await mount();
      expect(dir[c.model]!()).toEqual(c.a);

      host.model.set(c.b);
      await settle(fixture);
      expect(dir[c.model]!()).toEqual(c.b);

      dir[c.model]!.set!(c.a);
      await settle(fixture);
      expect(host.model()).toEqual(c.a);
    });

    it('follows [disabled]', async () => {
      const { fixture, host, dir } = await mount();
      host.locked.set(true);
      await settle(fixture);
      expect(dir['disabled']!()).toBe(true);
    });

    it('marks touched through markAsTouched', async () => {
      const { fixture, dir, ngModel } = await mount();
      ngModel.control.markAsTouched();
      await settle(fixture);
      expect(dir['touched']!()).toBe(true);
    });

    it('KNOWN GAP: a template required marks the control required but never validates', async () => {
      const { fixture, host, dir, ngModel } = await mount(true);
      host.model.set(c.empty);
      await settle(fixture);
      const validator = fixture.debugElement.query(By.directive(RequiredValidator)).injector.get(RequiredValidator);

      expect({
        sdkRequired: dir['required']!(),
        validatorInput: validator.required,
        error: ngModel.control.hasError('required'),
      }).toEqual({
        sdkRequired: true,
        validatorInput: '',
        error: false,
      });
    });
  });

  describe('user interaction through the DOM', () => {
    it('et-input: typing updates the FormControl and blur marks it touched', async () => {
      const { fixture, ctrl, el } = await mountReactive(caseNamed('et-input'));
      const input = el.matches('input') ? (el as HTMLInputElement) : el.querySelector('input')!;
      input.value = 'typed';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      blur(input);
      await settle(fixture);

      expect({ value: ctrl.value, dirty: ctrl.dirty, touched: ctrl.touched }).toEqual({
        value: 'typed',
        dirty: true,
        touched: true,
      });
    });

    it('et-checkbox: a click toggles the FormControl', async () => {
      const { fixture, ctrl, el } = await mountReactive(caseNamed('et-checkbox'));
      el.click();
      await settle(fixture);
      expect(ctrl.value).toBe(false);
    });

    it('et-radio-group: clicking a radio selects its value', async () => {
      const { fixture, ctrl } = await mountReactive(caseNamed('et-radio-group'));
      (fixture.nativeElement.querySelectorAll('et-radio')[1] as HTMLElement).click();
      await settle(fixture);
      expect(ctrl.value).toBe('b');
    });
  });

  describe('errors that only reactive forms produce', () => {
    @Component({
      imports: [ReactiveFormsModule, FORM_FIELD_IMPORTS, INPUT_IMPORTS],
      template: `<et-form-field><et-label>Name</et-label><et-input [formControl]="ctrl" /></et-form-field>`,
    })
    class MinLengthHost {
      public ctrl = new FormControl('ab', [Validators.minLength(3)]);
    }

    const render = async () => {
      const fixture = TestBed.createComponent(MinLengthHost);
      await settle(fixture);
      fixture.componentInstance.ctrl.markAsTouched();
      await settle(fixture);

      return fixture;
    };

    it('minlength from Validators.minLength shows the built-in text with its bound', async () => {
      const fixture = await render();
      const dir = fixture.debugElement.query(By.directive(InputDirective)).injector.get(InputDirective);

      expect(dir.errors().map((e) => e.kind)).toEqual(['minlength']);
      expect(fixture.nativeElement.textContent).toContain('Must be at least 3 characters');
    });

    it.each([
      ['min', [Validators.min(5)], 2, 'Must be at least 5'],
      ['max', [Validators.max(5)], 9, 'Must be at most 5'],
    ])('Validators.%s shows the built-in text with its bound', async (_kind, validators, value, text) => {
      @Component({
        imports: [ReactiveFormsModule, FORM_FIELD_IMPORTS, NUMBER_INPUT_IMPORTS],
        template: `<et-form-field><et-label>Count</et-label><et-number-input [formControl]="ctrl" /></et-form-field>`,
      })
      class BoundHost {
        public ctrl = new FormControl(value, validators);
      }

      const fixture = TestBed.createComponent(BoundHost);
      await settle(fixture);
      fixture.componentInstance.ctrl.markAsTouched();
      await settle(fixture);
      expect(fixture.nativeElement.textContent).toContain(text);
    });

    it('Validators.maxLength shows the built-in text with its bound', async () => {
      const fixture = await render();
      fixture.componentInstance.ctrl.setValidators([Validators.maxLength(1)]);
      fixture.componentInstance.ctrl.updateValueAndValidity();
      await settle(fixture);
      expect(fixture.nativeElement.textContent).toContain('Must be at most 1 characters');
    });

    it('provideFormErrorMessageResolver maps minlength and a setErrors backend error', async () => {
      TestBed.overrideProvider(FORM_ERROR_MESSAGE_RESOLVER, {
        useValue: (e: { kind: string; context?: unknown }) =>
          e.kind === 'minlength'
            ? `At least ${(e.context as { requiredLength: number }).requiredLength} characters`
            : e.kind === 'backend'
              ? String(e.context)
              : null,
      });
      const fixture = await render();
      expect(fixture.nativeElement.textContent).toContain('At least 3 characters');

      fixture.componentInstance.ctrl.setErrors({ backend: 'Name taken' });
      await settle(fixture);
      expect(fixture.nativeElement.textContent).toContain('Name taken');
    });
  });
});
