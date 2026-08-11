import { Component, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, minLength } from '@angular/forms/signals';
import '../../../../test-helpers';
import { InputDirective } from '../../input/headless';
import { FIELD_WARNINGS, warn } from './field-warnings';
import { FormFieldDirective } from './form-field.directive';
import { LabelDirective } from './label.directive';

@Component({
  template: `
    <div etFormField>
      <et-label>Password</et-label>
      <input [formField]="passwordForm.password" etInput />
    </div>
  `,
  imports: [FormFieldDirective, LabelDirective, InputDirective, FormField],
})
class WarnedFieldTestHost {
  public model = signal({ password: 'hunter22' });

  public passwordForm = form(
    this.model,
    (s) => {
      minLength(s.password, 4, { message: 'Too short' });
      warn(s.password, ({ value }) => (value() === 'hunter22' ? 'This password is easy to guess.' : null));
    },
    { injector: TestBed.inject(Injector) },
  );
}

describe('warn', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('collects the warnings of every rule on the field without touching its validity', () => {
    const injector = TestBed.inject(Injector);
    const model = signal({ quantity: 120 });

    const quantityForm = form(
      model,
      (s) => {
        warn(s.quantity, ({ value }) => (value() > 100 ? 'More than we usually have in stock.' : null));
        warn(s.quantity, ({ value }) => (value() % 10 === 0 ? { kind: 'roundNumber' } : null));
      },
      { injector },
    );

    expect(quantityForm.quantity().metadata(FIELD_WARNINGS)?.()).toEqual([
      { kind: 'etWarning', message: 'More than we usually have in stock.' },
      { kind: 'roundNumber' },
    ]);
    expect(quantityForm.quantity().errors()).toEqual([]);
    expect(quantityForm.quantity().valid()).toBe(true);
  });

  it('accepts a list, and drops the empty results', () => {
    const injector = TestBed.inject(Injector);
    const model = signal({ note: 'x' });

    const noteForm = form(
      model,
      (s) => {
        warn(s.note, () => ['first', { kind: 'second', message: 'second' }]);
        warn(s.note, () => null);
      },
      { injector },
    );

    expect(noteForm.note().metadata(FIELD_WARNINGS)?.()).toEqual([
      { kind: 'etWarning', message: 'first' },
      { kind: 'second', message: 'second' },
    ]);
  });
});

describe('FormFieldDirective warnings', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [WarnedFieldTestHost] }));

  it("reads the bound field's warnings, and gives the slot up to an error", () => {
    const fixture = TestBed.createComponent(WarnedFieldTestHost);
    fixture.detectChanges();

    const host = fixture.debugElement.children[0];

    if (!host) {
      throw new Error('Expected a form-field host debug element.');
    }

    const directive = host.injector.get(FormFieldDirective);

    expect(directive.warnings()).toEqual([{ kind: 'etWarning', message: 'This password is easy to guess.' }]);
    expect(directive.displaysWarning()).toBe(true);
    expect(directive.describedById()).toBe(directive.warningId());

    fixture.componentInstance.model.set({ password: 'no' });
    fixture.componentInstance.passwordForm.password().markAsTouched();
    fixture.detectChanges();

    expect(directive.warnings()).toEqual([]);
    expect(directive.displaysWarning()).toBe(false);
    expect(directive.describedById()).toBe(directive.errorId());
  });
});
