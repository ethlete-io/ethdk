import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { form, schema, submit } from '@angular/forms/signals';
import { describe, expect, it, vi } from 'vitest';
import {
  createQuerySubmission,
  executeUntilSettled,
  mapViolationsToFormErrors,
  SERVER_ERROR_KIND,
  SERVER_VIOLATION_ERROR_KIND,
  validateWithQuery,
} from '../index';
import { useScenario } from './harness';

type UserModel = { email: string; items: { name: string }[] };
type CreateUserArgs = { body: UserModel; response: { id: number; email: string } };

const baseModel = (): UserModel => ({ email: '', items: [{ name: '' }, { name: '' }] });

describe('mapping violations onto signal forms (manual submit path)', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('maps each violation onto its field with kind etServerViolation and the documented message', async () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({
      status: 422,
      body: {
        violations: [
          { message: 'This value should not be blank.', propertyPath: 'email' },
          { message: 'Name is required.', propertyPath: 'items[1].name' },
        ],
      },
    }));

    const createUser = s.post<CreateUserArgs>('/users');
    const c = s.consumer();
    const testForm = c.run(() => form(signal(baseModel())));
    const query = c.run(() => createUser());

    const submitted = submit(testForm, async (field) => {
      const snapshot = await executeUntilSettled(query, { args: { body: field().value() } });
      const error = snapshot.error();

      if (!error) return;

      return mapViolationsToFormErrors({ fieldTree: field, error });
    });

    await s.settle();
    await submitted;

    expect(testForm.email().errors()).toEqual([
      expect.objectContaining({ kind: SERVER_VIOLATION_ERROR_KIND, message: 'This value should not be blank.' }),
    ]);
    expect(testForm.items[1]!.name().errors()).toEqual([
      expect.objectContaining({ kind: SERVER_VIOLATION_ERROR_KIND, message: 'Name is required.' }),
    ]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
    c.destroy();
  });

  it('clears a mapped violation once the field is edited', async () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({
      status: 422,
      body: { violations: [{ message: 'This value should not be blank.', propertyPath: 'email' }] },
    }));

    const createUser = s.post<CreateUserArgs>('/users');
    const c = s.consumer();
    const testForm = c.run(() => form(signal(baseModel())));
    const query = c.run(() => createUser());

    const submitted = submit(testForm, async (field) => {
      const snapshot = await executeUntilSettled(query, { args: { body: field().value() } });
      const error = snapshot.error();

      if (!error) return;

      return mapViolationsToFormErrors({ fieldTree: field, error });
    });

    await s.settle();
    await submitted;

    expect(testForm.email().errors()).toHaveLength(1);

    testForm.email().value.set('ada@example.com');

    expect(testForm.email().errors()).toEqual([]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
    c.destroy();
  });

  it('lands an unresolved violation as a form-level error on the submitted field by default', async () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({
      status: 422,
      body: { violations: [{ message: 'Something is wrong.', propertyPath: 'doesNotExist' }] },
    }));

    const createUser = s.post<CreateUserArgs>('/users');
    const c = s.consumer();
    const testForm = c.run(() => form(signal(baseModel())));
    const query = c.run(() => createUser());

    const submitted = submit(testForm, async (field) => {
      const snapshot = await executeUntilSettled(query, { args: { body: field().value() } });
      const error = snapshot.error();

      if (!error) return;

      return mapViolationsToFormErrors({ fieldTree: field, error });
    });

    await s.settle();
    await submitted;

    expect(testForm().errors()).toEqual([
      expect.objectContaining({ kind: SERVER_VIOLATION_ERROR_KIND, message: 'Something is wrong.' }),
    ]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
    c.destroy();
  });

  it('drops an unresolved violation when onUnmappedViolation returns null', async () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({
      status: 422,
      body: { violations: [{ message: 'Something is wrong.', propertyPath: 'doesNotExist' }] },
    }));

    const createUser = s.post<CreateUserArgs>('/users');
    const c = s.consumer();
    const testForm = c.run(() => form(signal(baseModel())));
    const query = c.run(() => createUser());

    const submitted = submit(testForm, async (field) => {
      const snapshot = await executeUntilSettled(query, { args: { body: field().value() } });
      const error = snapshot.error();

      if (!error) return;

      return mapViolationsToFormErrors({ fieldTree: field, error, onUnmappedViolation: () => null });
    });

    await s.settle();
    await submitted;

    expect(testForm().errors()).toEqual([]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
    c.destroy();
  });

  it('rewrites a violation path with rewritePath before resolving it against the field tree', async () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({
      status: 422,
      body: { violations: [{ message: 'Bad email format.', propertyPath: 'payload.email' }] },
    }));

    const createUser = s.post<CreateUserArgs>('/users');
    const c = s.consumer();
    const testForm = c.run(() => form(signal(baseModel())));
    const query = c.run(() => createUser());

    const submitted = submit(testForm, async (field) => {
      const snapshot = await executeUntilSettled(query, { args: { body: field().value() } });
      const error = snapshot.error();

      if (!error) return;

      return mapViolationsToFormErrors({
        fieldTree: field,
        error,
        rewritePath: (path) => (path.startsWith('payload.') ? path.slice('payload.'.length) : null),
      });
    });

    await s.settle();
    await submitted;

    expect(testForm.email().errors()).toEqual([
      expect.objectContaining({ kind: SERVER_VIOLATION_ERROR_KIND, message: 'Bad email format.' }),
    ]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
    c.destroy();
  });
});

describe('a failed submit without violations degrades to etServerError', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('builds form-level errors from the normalized message on a plain 500, so the submit is not treated as success', async () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({ status: 500, body: { message: 'Internal error occurred.' } }));

    const createUser = s.post<CreateUserArgs>('/users');
    const c = s.consumer();
    const testForm = c.run(() => form(signal(baseModel())));
    const query = c.run(() => createUser());

    const submitted = submit(testForm, async (field) => {
      const snapshot = await executeUntilSettled(query, { args: { body: field().value() } });
      const error = snapshot.error();

      if (!error) return;

      return mapViolationsToFormErrors({ fieldTree: field, error });
    });

    await s.settle();
    const success = await submitted;

    expect(success).toBe(false);
    expect(testForm().errors()).toEqual([
      expect.objectContaining({ kind: SERVER_ERROR_KIND, message: 'Internal error occurred.' }),
    ]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
    c.destroy();
  });
});

describe('createQuerySubmission', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('sends the submitted form value as the request body and resolves with no errors and the documented result on 2xx', async () => {
    const s = scenario();
    let receivedBody: unknown;
    s.api.on('POST', '/users', ({ body }) => {
      receivedBody = body;
      return { status: 201, body: { id: 1, email: 'ada@example.com' } };
    });

    const createUser = s.post<CreateUserArgs>('/users');
    const onSuccess = vi.fn();
    const c = s.consumer();
    const submission = c.run(() =>
      createQuerySubmission({ queryCreator: createUser, args: (value: UserModel) => ({ body: value }), onSuccess }),
    );
    const testForm = c.run(() => form(signal(baseModel()), { submission: { action: submission.action } }));

    testForm.email().value.set('ada@example.com');

    const submitted = submit(testForm);

    await s.settle();
    await submitted;

    // The fake backend hands the raw body across; a JSON round trip drops the signal-forms symbols.
    expect(JSON.parse(JSON.stringify(receivedBody))).toEqual({
      email: 'ada@example.com',
      items: [{ name: '' }, { name: '' }],
    });
    expect(onSuccess).toHaveBeenCalledWith({ id: 1, email: 'ada@example.com' }, expect.anything());
    expect(submission.query.response()).toEqual({ id: 1, email: 'ada@example.com' });
    expect(testForm().errors()).toEqual([]);

    c.destroy();
  });

  it('maps a 422 onto fields exactly like the manual mapViolationsToFormErrors path', async () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({
      status: 422,
      body: {
        violations: [
          { message: 'This value should not be blank.', propertyPath: 'email' },
          { message: 'Name is required.', propertyPath: 'items[1].name' },
        ],
      },
    }));

    const createUser = s.post<CreateUserArgs>('/users');
    const onSuccess = vi.fn();
    const c = s.consumer();
    const submission = c.run(() =>
      createQuerySubmission({ queryCreator: createUser, args: (value: UserModel) => ({ body: value }), onSuccess }),
    );
    const testForm = c.run(() => form(signal(baseModel()), { submission: { action: submission.action } }));

    const submitted = submit(testForm);

    await s.settle();
    await submitted;

    expect(onSuccess).not.toHaveBeenCalled();
    expect(testForm.email().errors()).toEqual([
      expect.objectContaining({ kind: SERVER_VIOLATION_ERROR_KIND, message: 'This value should not be blank.' }),
    ]);
    expect(testForm.items[1]!.name().errors()).toEqual([
      expect.objectContaining({ kind: SERVER_VIOLATION_ERROR_KIND, message: 'Name is required.' }),
    ]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
    c.destroy();
  });

  it('rewrites a violation path via config.rewritePath', async () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({
      status: 422,
      body: { violations: [{ message: 'Bad email format.', propertyPath: 'payload.email' }] },
    }));

    const createUser = s.post<CreateUserArgs>('/users');
    const c = s.consumer();
    const submission = c.run(() =>
      createQuerySubmission({
        queryCreator: createUser,
        args: (value: UserModel) => ({ body: value }),
        rewritePath: (path) => (path.startsWith('payload.') ? path.slice('payload.'.length) : null),
      }),
    );
    const testForm = c.run(() => form(signal(baseModel()), { submission: { action: submission.action } }));

    const submitted = submit(testForm);

    await s.settle();
    await submitted;

    expect(testForm.email().errors()).toEqual([
      expect.objectContaining({ kind: SERVER_VIOLATION_ERROR_KIND, message: 'Bad email format.' }),
    ]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
    c.destroy();
  });
});

describe('validateWithQuery', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const CACHE_LEAK_REASON =
    "validateWithQuery's internal query never unbinds from the cache repository when the owning form's injector is destroyed (see report)";

  it('reports no errors on a 204 success', async () => {
    const s = scenario();
    s.api.on('POST', '/validate', () => ({ status: 204 }));

    const validateEmail = s.post<{ body: { email: string }; response: void }>('/validate');
    const c = s.consumer();
    const testForm = c.run(() => {
      const emailSchema = schema<{ email: string }>((p) => {
        validateWithQuery(p, {
          queryCreator: validateEmail,
          args: (ctx) => ({ body: { email: ctx.value().email } }),
          debounce: 0,
        });
      });

      return form(signal({ email: 'ada@example.com' }), emailSchema);
    });

    await s.settle();

    expect(testForm().errors()).toEqual([]);

    s.allow('cache', CACHE_LEAK_REASON);
    c.destroy();
  });

  it('maps a 422 violation list onto the field by propertyPath', async () => {
    const s = scenario();
    s.api.on('POST', '/validate', () => ({
      status: 422,
      body: { violations: [{ message: 'Email already taken.', propertyPath: 'email' }] },
    }));

    const validateEmail = s.post<{ body: { email: string }; response: void }>('/validate');
    const c = s.consumer();
    const testForm = c.run(() => {
      const emailSchema = schema<{ email: string }>((p) => {
        validateWithQuery(p, {
          queryCreator: validateEmail,
          args: (ctx) => ({ body: { email: ctx.value().email } }),
          debounce: 0,
        });
      });

      return form(signal({ email: 'ada@example.com' }), emailSchema);
    });

    await s.settle();

    expect(testForm.email().errors()).toEqual([
      expect.objectContaining({ kind: SERVER_VIOLATION_ERROR_KIND, message: 'Email already taken.' }),
    ]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
    s.allow('cache', CACHE_LEAK_REASON);
    c.destroy();
  });

  it('degrades a network / other error to a non-swallowed form-level error', async () => {
    const s = scenario();
    s.api.on('POST', '/validate', () => ({ status: 500, body: { message: 'Service unavailable.' } }));

    const validateEmail = s.post<{ body: { email: string }; response: void }>('/validate');
    const c = s.consumer();
    const testForm = c.run(() => {
      const emailSchema = schema<{ email: string }>((p) => {
        validateWithQuery(p, {
          queryCreator: validateEmail,
          args: (ctx) => ({ body: { email: ctx.value().email } }),
          debounce: 0,
        });
      });

      return form(signal({ email: 'ada@example.com' }), emailSchema);
    });

    await s.settle();

    expect(testForm().errors()).toEqual([
      expect.objectContaining({ kind: SERVER_ERROR_KIND, message: 'Service unavailable.' }),
    ]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
    s.allow('cache', CACHE_LEAK_REASON);
    c.destroy();
  });

  it('debounces the request by the documented default of 300ms as the field value changes', async () => {
    const s = scenario();
    s.api.on('POST', '/validate', () => ({ status: 204 }));

    const validateEmail = s.post<{ body: { email: string }; response: void }>('/validate');
    const c = s.consumer();
    const testForm = c.run(() => {
      const emailSchema = schema<{ email: string }>((p) => {
        validateWithQuery(p, { queryCreator: validateEmail, args: (ctx) => ({ body: { email: ctx.value().email } }) });
      });

      return form(signal({ email: 'ada@example.com' }), emailSchema);
    });

    await s.settle();
    const requestsBeforeEdit = s.api.requestCount('POST', '/validate');

    testForm.email().value.set('ada2@example.com');

    s.tick(299);
    expect(s.api.requestCount('POST', '/validate')).toBe(requestsBeforeEdit);

    await s.settle(1);
    expect(s.api.requestCount('POST', '/validate')).toBe(requestsBeforeEdit + 1);

    await s.settle();
    s.allow('cache', CACHE_LEAK_REASON);
    c.destroy();
  });

  it("does not let a stale in-flight response land once the field's value has moved on", async () => {
    const s = scenario();
    s.api.on('POST', '/validate', ({ body }) => {
      const email = (body as { email: string }).email;

      if (email === 'stale@example.com') {
        return {
          status: 422,
          body: { violations: [{ message: 'stale is taken', propertyPath: 'email' }] },
          delay: 1000,
        };
      }

      return { status: 204, delay: 50 };
    });

    const validateEmail = s.post<{ body: { email: string }; response: void }>('/validate');
    const c = s.consumer();
    const testForm = c.run(() => {
      const emailSchema = schema<{ email: string }>((p) => {
        validateWithQuery(p, { queryCreator: validateEmail, args: (ctx) => ({ body: { email: ctx.value().email } }) });
      });

      return form(signal({ email: 'stale@example.com' }), emailSchema);
    });

    await s.settle(300);
    expect(s.api.requestCount('POST', '/validate')).toBe(1);

    testForm.email().value.set('fresh@example.com');

    await s.settle(300);
    expect(s.api.requestCount('POST', '/validate')).toBe(2);

    await s.settle(60);
    expect(testForm.email().errors()).toEqual([]);

    await s.settle(700);
    expect(testForm.email().errors()).toEqual([]);

    s.allow('cache', CACHE_LEAK_REASON);
    c.destroy();
  });
});
