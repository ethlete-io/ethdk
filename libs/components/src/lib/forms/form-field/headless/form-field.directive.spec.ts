import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ValidationError } from '@angular/forms/signals';
import '../../../../test-helpers';
import { InputDirective } from '../../input/headless';
import { HintComponent } from '../hint.component';
import { FormFieldDirective } from './form-field.directive';
import { FormFieldControl } from './form-field.tokens';
import { LabelDirective } from './label.directive';

@Component({
  template: `
    <div etFormField>
      <et-label>Test label</et-label>
      <input etInput />
    </div>
  `,
  imports: [FormFieldDirective, LabelDirective, HintComponent, InputDirective],
})
class FormFieldTestHost {}

describe('FormFieldDirective', () => {
  let fixture: ComponentFixture<FormFieldTestHost>;

  const getDirective = () => {
    const hostDebugElement = fixture.debugElement.children[0];

    if (!hostDebugElement) {
      throw new Error('Expected a form-field host debug element.');
    }

    return hostDebugElement.injector.get(FormFieldDirective);
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FormFieldTestHost] });
    fixture = TestBed.createComponent(FormFieldTestHost);
    fixture.detectChanges();
  });

  it('should create', () => {
    const formFieldEl = fixture.nativeElement.querySelector('[etFormField]');
    expect(formFieldEl).toBeTruthy();
  });

  it('should register label', () => {
    const directive = getDirective();
    expect(directive.registeredLabel()).toBeTruthy();
  });

  it('should expose shouldDisplayError as false initially', () => {
    const directive = getDirective();
    expect(directive.shouldDisplayError()).toBe(false);
  });

  it('should expose empty errors initially', () => {
    const directive = getDirective();
    expect(directive.errors()).toEqual([]);
  });

  it('should compute shouldDisplayError from registered control', () => {
    const directive = getDirective();

    const mockControl: FormFieldControl = {
      touched: signal(true),
      invalid: signal(true),
      errors: signal([{ kind: 'required', message: 'Required' }]),
      name: signal('test'),
      describedBy: signal<string | null>(null),
      activate: () => undefined,
    };

    directive.registerControl(mockControl);

    expect(directive.shouldDisplayError()).toBe(true);
    expect(directive.errors()).toEqual([{ kind: 'required', message: 'Required' }]);
  });

  it('should not display error when not touched', () => {
    const directive = getDirective();

    const mockControl: FormFieldControl = {
      touched: signal(false),
      invalid: signal(true),
      errors: signal([{ kind: 'required', message: 'Required' }]),
      name: signal('test'),
      describedBy: signal<string | null>(null),
      activate: () => undefined,
    };

    directive.registerControl(mockControl);

    expect(directive.shouldDisplayError()).toBe(false);
  });

  it('should unregister control', () => {
    const directive = getDirective();

    const mockControl: FormFieldControl = {
      touched: signal(true),
      invalid: signal(true),
      errors: signal([]),
      name: signal('test'),
      describedBy: signal<string | null>(null),
      activate: () => undefined,
    };

    directive.registerControl(mockControl);
    expect(directive.registeredControl()).toBe(mockControl);

    directive.unregisterControl(mockControl);
    expect(directive.registeredControl()).toBeNull();
  });

  it('should set describedBy on registered control', () => {
    const directive = getDirective();

    const describedBy = signal<string | null>(null);
    const mockControl: FormFieldControl = {
      touched: signal(false),
      invalid: signal(false),
      errors: signal([]),
      name: signal('myfield'),
      describedBy,
      activate: () => undefined,
    };

    directive.registerControl(mockControl);
    expect(describedBy()).toBeNull();
  });

  it('should set describedBy to the hint when one is registered', () => {
    TestBed.resetTestingModule();

    @Component({
      template: `
        <div etFormField>
          <et-label>Test label</et-label>
          <input etInput />
          <et-hint>Helpful hint</et-hint>
        </div>
      `,
      imports: [FormFieldDirective, LabelDirective, HintComponent, InputDirective],
    })
    class FormFieldWithHintTestHost {}

    TestBed.configureTestingModule({ imports: [FormFieldWithHintTestHost] });

    const formFieldFixture = TestBed.createComponent(FormFieldWithHintTestHost);
    formFieldFixture.detectChanges();

    const hostDebugElement = formFieldFixture.debugElement.children[0];

    if (!hostDebugElement) {
      throw new Error('Expected a form-field host debug element.');
    }

    const directive = hostDebugElement.injector.get(FormFieldDirective);
    const describedBy = signal<string | null>(null);
    const touched = signal(false);
    const invalid = signal(false);
    const errors = signal<readonly ValidationError.WithOptionalFieldTree[]>([]);

    const mockControl: FormFieldControl = {
      touched,
      invalid,
      errors,
      name: signal('myfield'),
      describedBy,
      activate: () => undefined,
    };

    directive.registerControl(mockControl);
    formFieldFixture.detectChanges();

    expect(describedBy()).toBe('et-form-field-hint-myfield');

    touched.set(true);
    invalid.set(true);
    errors.set([{ kind: 'required', message: 'Required' }]);
    formFieldFixture.detectChanges();

    expect(describedBy()).toBe('et-form-field-error-myfield');
  });
});
