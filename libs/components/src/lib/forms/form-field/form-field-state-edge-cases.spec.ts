import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { InputDirective } from '../input/headless';
import { provideFormFieldDefaults } from './form-field-defaults';
import { FormFieldComponent } from './form-field.component';
import { FieldWarningResult, LabelDirective, warn } from './headless';
import { provideFormWarningMessageResolver } from './form-warning.component';

@Component({
  template: `
    <et-form-field id="plain">
      <et-label>Plain</et-label>
      <input [warnings]="warnings()" [hidden]="hidden()" etInput />
    </et-form-field>

    <et-form-field id="bound">
      <et-label>Bound</et-label>
      <input [formField]="demoForm.name" [warnings]="extraWarning()" etInput />
    </et-form-field>
  `,
  imports: [FormFieldComponent, InputDirective, LabelDirective, FormField],
})
class FieldStateHost {
  warnings = signal<FieldWarningResult>(null);
  hidden = signal(false);
  extraWarning = signal<FieldWarningResult>(null);
  model = signal({ name: 'x' });
  demoForm = form(this.model, (s) => {
    required(s.name, { message: 'Required.' });
    warn(s.name, ({ value }) => (value().length < 3 ? 'Short name.' : null));
  });
}

const mount = (providers: unknown[] = []) => {
  TestBed.configureTestingModule({
    imports: [FieldStateHost],
    providers: [provideColorThemes([...TEST_COLOR_THEMES]), ...(providers as [])],
  });

  const fixture = TestBed.createComponent(FieldStateHost);
  fixture.detectChanges();

  const field = (id: string) => fixture.nativeElement.querySelector(`#${id}`) as HTMLElement;
  const input = (id: string) => field(id).querySelector('input') as HTMLInputElement;
  const warningTexts = (id: string) =>
    Array.from(field(id).querySelectorAll('et-form-warning')).map((element) => element.textContent?.trim());
  const describedTarget = (id: string) => {
    const ids = input(id).getAttribute('aria-describedby');

    return ids ? field(id).querySelector(`[id="${ids}"]`) : null;
  };
  const update = () => {
    fixture.detectChanges();
    TestBed.tick();
  };

  return { fixture, host: fixture.componentInstance, field, input, warningTexts, describedTarget, update };
};

describe('form field hidden and warning edge cases', () => {
  it.each([
    ['an empty string', ''],
    ['an empty list', []],
    ['a list of empty entries', ['', null]],
    ['undefined', undefined],
  ])('shows no warning for %s', (_, warnings) => {
    const { host, field, warningTexts, update } = mount();

    host.warnings.set(warnings as FieldWarningResult);
    update();

    expect(warningTexts('plain')).toEqual([]);
    expect(field('plain').hasAttribute('data-warning')).toBe(false);
  });

  it('drops the empty entries of a mixed list and keeps the rest in order', () => {
    const { host, warningTexts, update } = mount();

    host.warnings.set(['', 'First.', null, { kind: 'second', message: 'Second.' }] as FieldWarningResult);
    update();

    expect(warningTexts('plain')).toEqual(['First.', 'Second.']);
  });

  it('points aria-describedby at the warning while it shows, and drops it once cleared', () => {
    const { host, input, describedTarget, update } = mount();

    host.warnings.set('Careful.');
    update();

    expect(describedTarget('plain')?.textContent).toContain('Careful.');

    host.warnings.set(null);
    update();

    expect(input('plain').hasAttribute('aria-describedby')).toBe(false);
  });

  it('never marks a warned field invalid', () => {
    const { host, input, update } = mount();

    host.warnings.set('Careful.');
    update();

    expect(input('plain').getAttribute('aria-invalid')).not.toBe('true');
  });

  it("adds a control's own warnings to the bound field's warn() results", () => {
    const { host, warningTexts, update } = mount();

    host.extraWarning.set('Also this.');
    update();

    expect(warningTexts('bound')).toEqual(['Short name.', 'Also this.']);
  });

  it('gives the slot to an error and hands it back to the warning once the error is fixed', () => {
    const { host, field, warningTexts, update } = mount();

    host.model.set({ name: '' });
    host.demoForm.name().markAsTouched();
    update();

    expect(field('bound').hasAttribute('data-warning')).toBe(false);
    expect(field('bound').textContent).toContain('Required.');

    host.model.set({ name: 'ab' });
    update();

    expect(warningTexts('bound')).toEqual(['Short name.']);
    expect(field('bound').hasAttribute('data-warning')).toBe(true);
  });

  it('localizes a warning by kind and falls back to its message when the resolver returns null', () => {
    const { host, warningTexts, update } = mount([
      provideFormWarningMessageResolver((warning) => (warning.kind === 'known' ? 'Localized.' : null)),
    ]);

    host.warnings.set([
      { kind: 'known', message: 'Raw.' },
      { kind: 'other', message: 'Own message.' },
    ]);
    update();

    expect(warningTexts('plain')).toEqual(['Localized.', 'Own message.']);
  });

  it('hides the whole field and shows it again', () => {
    const { host, field, update } = mount();

    host.hidden.set(true);
    update();
    expect(field('plain').style.display).toBe('none');

    host.hidden.set(false);
    update();
    expect(field('plain').style.display).toBe('');
  });

  it('keeps a hidden field hidden while it carries a warning', () => {
    const { host, field, update } = mount();

    host.warnings.set('Careful.');
    host.hidden.set(true);
    update();

    expect(field('plain').style.display).toBe('none');
  });
});

describe('provideFormFieldDefaults edge cases', () => {
  it('keeps the built-in default for a key explicitly set to undefined', () => {
    const { field } = mount([provideFormFieldDefaults({ size: undefined, labelMode: 'inline' })]);

    expect(field('plain').getAttribute('data-size')).toBe('md');
    expect(field('plain').getAttribute('data-label-mode')).toBe('inline');
  });

  it('keeps every built-in default for an empty override', () => {
    const { field } = mount([provideFormFieldDefaults({})]);

    expect(field('plain').getAttribute('data-appearance')).toBe('box');
    expect(field('plain').getAttribute('data-fill')).toBe('transparent');
    expect(field('plain').getAttribute('data-label-mode')).toBe('static');
    expect(field('plain').getAttribute('data-size')).toBe('md');
  });
});
