import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ValidationError } from '@angular/forms/signals';
import { provideFormFieldLabels } from './form-field-labels';
import { FormErrorComponent, provideFormErrorMessageResolver } from './form-error.component';

@Component({
  template: '<et-form-error [error]="error()" />',
  imports: [FormErrorComponent],
})
class TestHostComponent {
  error = input.required<ValidationError.WithOptionalFieldTree>();
}

const renderError = (error: ValidationError.WithOptionalFieldTree) => {
  const fixture = TestBed.createComponent(TestHostComponent);
  fixture.componentRef.setInput('error', error);
  fixture.detectChanges();

  return (fixture.nativeElement as HTMLElement).querySelector('et-form-error')?.textContent?.trim();
};

describe('FormErrorComponent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('should render the error message verbatim by default', () => {
    TestBed.configureTestingModule({});

    expect(renderError({ kind: 'required', message: 'This field is required' })).toBe('This field is required');
  });

  it('should render an empty string for a message-less error by default', () => {
    TestBed.configureTestingModule({});
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(renderError({ kind: 'customKind' })).toBe('');
  });

  it.each([
    [{ kind: 'required' }, 'This field is required'],
    [{ kind: 'min', min: 3 }, 'Must be at least 3'],
    [{ kind: 'max', max: 9 }, 'Must be at most 9'],
    [{ kind: 'minLength', minLength: 4 }, 'Must be at least 4 characters'],
    [{ kind: 'maxLength', maxLength: 8 }, 'Must be at most 8 characters'],
    [{ kind: 'pattern', pattern: /a/ }, 'Invalid format'],
    [{ kind: 'email' }, 'Enter a valid email address'],
  ])('should render the default text for %j', (error, text) => {
    TestBed.configureTestingModule({});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(renderError(error as ValidationError.WithOptionalFieldTree)).toBe(text);
    expect(warn).not.toHaveBeenCalled();
  });

  it('should prefer the validator message over the default text', () => {
    TestBed.configureTestingModule({});

    expect(renderError({ kind: 'min', min: 3, message: 'Too small' } as ValidationError.WithOptionalFieldTree)).toBe(
      'Too small',
    );
  });

  it('should prefer a resolver over the default text', () => {
    TestBed.configureTestingModule({ providers: [provideFormErrorMessageResolver(() => 'Resolved')] });

    expect(renderError({ kind: 'email' })).toBe('Resolved');
  });

  it('should use a provided label override', () => {
    TestBed.configureTestingModule({
      providers: [
        provideFormFieldLabels({
          errorRequired: 'Pflichtfeld',
          errorMinLength: (error) => `Mindestens ${error.minLength} Zeichen`,
        }),
      ],
    });

    expect(renderError({ kind: 'required' })).toBe('Pflichtfeld');
    expect(renderError({ kind: 'minLength', minLength: 2 } as ValidationError.WithOptionalFieldTree)).toBe(
      'Mindestens 2 Zeichen',
    );
  });

  it('should warn once per kind when an error resolves to no message', () => {
    TestBed.configureTestingModule({});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    renderError({ kind: 'messagelessKind' });
    renderError({ kind: 'messagelessKind' });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('"messagelessKind"');
    expect(warn.mock.calls[0]?.[0]).toContain('provideFormErrorMessageResolver');
  });

  it('should not warn when the error has a message', () => {
    TestBed.configureTestingModule({});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    renderError({ kind: 'messagedKind', message: 'Has text' });

    expect(warn).not.toHaveBeenCalled();
  });

  it('should prefer the resolved message when a resolver is provided', () => {
    TestBed.configureTestingModule({
      providers: [provideFormErrorMessageResolver((error) => (error.kind === 'required' ? 'Bitte ausfüllen' : null))],
    });

    expect(renderError({ kind: 'required', message: 'This field is required' })).toBe('Bitte ausfüllen');
  });

  it('should fall back to the error message when the resolver returns null', () => {
    TestBed.configureTestingModule({
      providers: [provideFormErrorMessageResolver(() => null)],
    });

    expect(renderError({ kind: 'minLength', message: 'Too short' })).toBe('Too short');
  });
});
