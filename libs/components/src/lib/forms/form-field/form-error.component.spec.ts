import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ValidationError } from '@angular/forms/signals';
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
  it('should render the error message verbatim by default', () => {
    TestBed.configureTestingModule({});

    expect(renderError({ kind: 'required', message: 'This field is required' })).toBe('This field is required');
  });

  it('should render an empty string for a message-less error by default', () => {
    TestBed.configureTestingModule({});

    expect(renderError({ kind: 'required' })).toBe('');
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
