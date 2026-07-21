import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FieldContext, PathKind, form } from '@angular/forms/signals';
import { vi } from 'vitest';
import { createQueryErrorResponse } from './query-error-response';
import { SERVER_ERROR_KIND, SERVER_VIOLATION_ERROR_KIND } from './query-signal-forms';
import { mapQueryValidationError } from './query-validator-core';

type Model = { name: string; email: string };

const violationListBody = (...violations: { message: string; propertyPath: string | null }[]) => ({ violations });

const httpError = (error: unknown, status = 422) => new HttpErrorResponse({ error, status });

describe('mapQueryValidationError', () => {
  const createTestForm = () => TestBed.runInInjectionContext(() => form(signal<Model>({ name: '', email: '' })));

  // The core only reads `ctx.fieldTree`, so a minimal stub is enough to exercise the mapping.
  const ctxFor = (fieldTree: unknown) => ({ fieldTree }) as unknown as FieldContext<Model, PathKind.Root>;

  it('should map a 422 violation onto the matching child field', () => {
    const testForm = createTestForm();
    const error = httpError(violationListBody({ message: 'Name is taken', propertyPath: 'name' }));

    const errors = mapQueryValidationError(error, ctxFor(testForm));

    expect(errors).toEqual([
      expect.objectContaining({
        kind: SERVER_VIOLATION_ERROR_KIND,
        message: 'Name is taken',
        fieldTree: testForm.name,
      }),
    ]);
  });

  it('should unwrap a QueryErrorResponse the same way', () => {
    const testForm = createTestForm();
    const error = createQueryErrorResponse(
      httpError(violationListBody({ message: 'Bad email', propertyPath: 'email' })),
    );

    const errors = mapQueryValidationError(error, ctxFor(testForm));

    expect(errors).toEqual([
      expect.objectContaining({
        kind: SERVER_VIOLATION_ERROR_KIND,
        message: 'Bad email',
        fieldTree: testForm.email,
      }),
    ]);
  });

  it('should unwrap a resource-wrapped error via its .cause', () => {
    const testForm = createTestForm();
    // `resource()` rethrows a non-Error value wrapped in an Error, with the original on `.cause`.
    const wrapped = new Error('Resource returned an error that is not an Error instance');
    wrapped.cause = httpError(violationListBody({ message: 'Name is taken', propertyPath: 'name' }));

    const errors = mapQueryValidationError(wrapped, ctxFor(testForm));

    expect(errors).toEqual([
      expect.objectContaining({
        kind: SERVER_VIOLATION_ERROR_KIND,
        message: 'Name is taken',
        fieldTree: testForm.name,
      }),
    ]);
  });

  it('should degrade a network / non-violation error to a non-swallowed form-level error', () => {
    const testForm = createTestForm();
    const error = httpError({ message: 'Service unavailable' }, 500);

    const errors = mapQueryValidationError(error, ctxFor(testForm));

    const list = errors as unknown as { fieldTree?: unknown }[];

    expect(list).toEqual([expect.objectContaining({ kind: SERVER_ERROR_KIND })]);
    expect(list[0]?.fieldTree).toBeUndefined();
  });

  it('should use a custom mapViolations override with the extracted violations', () => {
    const testForm = createTestForm();
    const error = httpError(violationListBody({ message: 'Name is taken', propertyPath: 'name' }));
    const mapViolations = vi.fn((violations: { message: string }[]) =>
      violations.map((v) => ({ kind: 'custom', message: v.message.toUpperCase() })),
    );

    const errors = mapQueryValidationError(error, ctxFor(testForm), mapViolations);

    expect(mapViolations).toHaveBeenCalledWith([expect.objectContaining({ propertyPath: 'name' })], expect.anything());
    expect(errors).toEqual([{ kind: 'custom', message: 'NAME IS TAKEN' }]);
  });
});
