import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { FormViolationView } from '@ethlete/types';
import { symfonyQueryErrorParser } from './query-error-parsers';
import { registerQueryErrorParser } from './query-error-parsing';
import { createQueryErrorResponse } from './query-error-response';
import {
  extractFormViolations,
  mapViolationsToFormErrors,
  SERVER_ERROR_KIND,
  SERVER_VIOLATION_ERROR_KIND,
  ServerViolationValidationError,
} from './query-signal-forms';

// Violation lists are read by the parser `withSymfonyErrors()` installs.
registerQueryErrorParser(symfonyQueryErrorParser);

const violation = (propertyPath: string | null, message = 'Invalid value'): FormViolationView => ({
  message,
  propertyPath,
});

const violationListBody = (...violations: FormViolationView[]) => ({ violations });

const httpError = (error: unknown, status = 422) => new HttpErrorResponse({ error, status });

describe('extractFormViolations', () => {
  it('should extract violations from a raw violation list body', () => {
    const violations = [violation('name')];

    expect(extractFormViolations(violationListBody(...violations))).toEqual(violations);
  });

  it('should extract violations from a plain violation array', () => {
    const violations = [{ message: 'Too short', propertyPath: 'name', invalidValue: 'x' }];

    expect(extractFormViolations(violations)).toEqual(violations);
  });

  it('should extract violations from an HttpErrorResponse', () => {
    const violations = [violation('name')];

    expect(extractFormViolations(httpError(violationListBody(...violations)))).toEqual(violations);
  });

  it('should extract violations from a QueryErrorResponse', () => {
    const violations = [violation('name'), violation('email')];
    const queryError = createQueryErrorResponse(httpError(violationListBody(...violations)));

    expect(extractFormViolations(queryError)).toEqual(violations);
  });

  it('should return an empty array for errors without violations', () => {
    expect(extractFormViolations(null)).toEqual([]);
    expect(extractFormViolations(undefined)).toEqual([]);
    expect(extractFormViolations('boom')).toEqual([]);
    expect(extractFormViolations({ message: 'boom' })).toEqual([]);
    expect(extractFormViolations(httpError({ message: 'boom' }, 500))).toEqual([]);
    expect(extractFormViolations([])).toEqual([]);
  });
});

describe('mapViolationsToFormErrors', () => {
  const createTestForm = () =>
    TestBed.runInInjectionContext(() =>
      form(
        signal({
          name: '',
          address: { street: '' },
          items: [{ label: '' }, { label: '' }],
        }),
      ),
    );

  it('should map a violation onto the matching field', () => {
    const testForm = createTestForm();

    const errors = mapViolationsToFormErrors({
      fieldTree: testForm,
      error: violationListBody(violation('name', 'Name is taken')),
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ kind: SERVER_VIOLATION_ERROR_KIND, message: 'Name is taken' });
    expect(errors[0]!.fieldTree).toBe(testForm.name);
  });

  it('should map nested and indexed property paths', () => {
    const testForm = createTestForm();

    const errors = mapViolationsToFormErrors({
      fieldTree: testForm,
      error: violationListBody(violation('address.street'), violation('items[1].label')),
    });

    expect(errors[0]!.fieldTree).toBe(testForm.address.street);
    expect(errors[1]!.fieldTree).toBe(testForm.items[1]!.label);
  });

  it('should map quoted bracket keys', () => {
    const testForm = createTestForm();

    const errors = mapViolationsToFormErrors({
      fieldTree: testForm,
      error: violationListBody(violation("address['street']")),
    });

    expect(errors[0]!.fieldTree).toBe(testForm.address.street);
  });

  it('should keep the violation on the produced error', () => {
    const testForm = createTestForm();
    const source = violation('name');

    const errors = mapViolationsToFormErrors({ fieldTree: testForm, error: violationListBody(source) });

    expect((errors[0] as ServerViolationValidationError).violation).toBe(source);
  });

  it('should turn unmapped violations into form-level errors', () => {
    const testForm = createTestForm();

    const errors = mapViolationsToFormErrors({
      fieldTree: testForm,
      error: violationListBody(violation('doesNotExist'), violation('items[99].label'), violation(null, 'Form broken')),
    });

    expect(errors).toHaveLength(3);

    for (const error of errors) {
      expect(error.kind).toBe(SERVER_VIOLATION_ERROR_KIND);
      expect(error.fieldTree).toBeUndefined();
    }
  });

  it('should let onUnmappedViolation replace or drop unmapped violations', () => {
    const testForm = createTestForm();

    const errors = mapViolationsToFormErrors({
      fieldTree: testForm,
      error: violationListBody(violation('doesNotExist', 'keep me'), violation(null, 'drop me')),
      onUnmappedViolation: (unmapped) =>
        unmapped.message === 'drop me' ? null : { kind: 'custom', message: unmapped.message },
    });

    expect(errors).toEqual([{ kind: 'custom', message: 'keep me' }]);
  });

  it('should resolve through rewritePath and treat a null rewrite as unmapped', () => {
    const testForm = createTestForm();

    const errors = mapViolationsToFormErrors({
      fieldTree: testForm,
      error: violationListBody(violation('payload.name'), violation('internal.secret')),
      rewritePath: (path) => (path.startsWith('payload.') ? path.slice('payload.'.length) : null),
    });

    expect(errors[0]!.fieldTree).toBe(testForm.name);
    expect(errors[1]!.fieldTree).toBeUndefined();
  });

  it('should degrade a violation-free failure to a form-level server error', () => {
    const testForm = createTestForm();
    const queryError = createQueryErrorResponse(httpError({ message: 'Internal error' }, 500));

    const errors = mapViolationsToFormErrors({ fieldTree: testForm, error: queryError });

    expect(errors).toEqual([{ kind: SERVER_ERROR_KIND, message: 'Internal error' }]);
  });

  it('should produce one form-level error per message for list-shaped failures', () => {
    const testForm = createTestForm();
    const queryError = createQueryErrorResponse(
      httpError({ statusCode: 400, message: ['first', 'second'], error: 'Bad Request' }, 400),
    );

    const errors = mapViolationsToFormErrors({ fieldTree: testForm, error: queryError });

    expect(errors).toEqual([
      { kind: SERVER_ERROR_KIND, message: 'first' },
      { kind: SERVER_ERROR_KIND, message: 'second' },
    ]);
  });

  it('should return no errors for a missing error or an explicitly empty violation array', () => {
    const testForm = createTestForm();

    expect(mapViolationsToFormErrors({ fieldTree: testForm, error: null })).toEqual([]);
    expect(mapViolationsToFormErrors({ fieldTree: testForm, error: undefined })).toEqual([]);
    expect(mapViolationsToFormErrors({ fieldTree: testForm, error: [] })).toEqual([]);
  });
});
