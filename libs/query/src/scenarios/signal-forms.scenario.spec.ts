import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { form, required, schema, submit } from '@angular/forms/signals';
import { describe, expect, it, vi } from 'vitest';
import {
  createQuerySubmission,
  def,
  executeUntilSettled,
  extractFormViolations,
  mapViolationsToFormErrors,
  SERVER_ERROR_KIND,
  SERVER_VIOLATION_ERROR_KIND,
  V2QueryClient,
  validateWithQuery,
  validateWithV2Query,
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

  it('maps violations handed in as a raw HttpErrorResponse and as a bare violation array', async () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({
      status: 422,
      body: { violations: [{ message: 'This value should not be blank.', propertyPath: 'email' }] },
    }));

    const createUser = s.post<CreateUserArgs>('/users');
    const c = s.consumer();
    const testForm = c.run(() => form(signal(baseModel())));
    const query = c.run(() => createUser());

    let extracted: unknown;
    const submitted = submit(testForm, async (field) => {
      const snapshot = await executeUntilSettled(query, { args: { body: field().value() } });
      const raw = snapshot.error()?.raw;

      extracted = extractFormViolations(raw);

      return mapViolationsToFormErrors({ fieldTree: field, error: raw });
    });

    await s.settle();
    await submitted;

    expect(extracted).toEqual([{ message: 'This value should not be blank.', propertyPath: 'email' }]);
    expect(testForm.email().errors()).toEqual([
      expect.objectContaining({ kind: SERVER_VIOLATION_ERROR_KIND, message: 'This value should not be blank.' }),
    ]);

    const bareArray = [{ message: 'Name is required.', propertyPath: 'items[0].name', invalidValue: null }];
    const bareForm = c.run(() => form(signal(baseModel())));
    const bareSubmitted = submit(bareForm, async (field) =>
      mapViolationsToFormErrors({ fieldTree: field, error: bareArray }),
    );

    await s.settle();
    await bareSubmitted;
    await s.settle();

    expect(extractFormViolations(bareArray)).toEqual(bareArray);
    expect(bareForm.items[0]!.name().errors()).toEqual([
      expect.objectContaining({ kind: SERVER_VIOLATION_ERROR_KIND, message: 'Name is required.' }),
    ]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
    c.destroy();
  });

  it('resolves a bracket-notation propertyPath onto the nested field', async () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({
      status: 422,
      body: { violations: [{ message: 'Name is required.', propertyPath: 'items[2].name' }] },
    }));

    const createUser = s.post<CreateUserArgs>('/users');
    const c = s.consumer();
    const testForm = c.run(() =>
      form(signal<UserModel>({ email: '', items: [{ name: 'a' }, { name: 'b' }, { name: '' }] })),
    );
    const query = c.run(() => createUser());

    const submitted = submit(testForm, async (field) => {
      const snapshot = await executeUntilSettled(query, { args: { body: field().value() } });
      const error = snapshot.error();

      if (!error) return;

      return mapViolationsToFormErrors({ fieldTree: field, error });
    });

    await s.settle();
    await submitted;

    expect(testForm.items[2]!.name().errors()).toEqual([
      expect.objectContaining({ kind: SERVER_VIOLATION_ERROR_KIND, message: 'Name is required.' }),
    ]);
    expect(testForm().errors()).toEqual([]);

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

  it('hands onSuccess the null response of a 204', async () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({ status: 204 }));

    const createUser = s.post<{ body: UserModel; response: { id: number } | null }>('/users');
    const seen: unknown[] = [];
    const c = s.consumer();
    const submission = c.run(() =>
      createQuerySubmission({
        queryCreator: createUser,
        args: (value: UserModel) => ({ body: value }),
        onSuccess: (response) => seen.push(response),
      }),
    );
    const testForm = c.run(() => form(signal(baseModel()), { submission: { action: submission.action } }));

    const submitted = submit(testForm);

    await s.settle();
    await submitted;

    expect(seen).toEqual([null]);

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

  it('keeps the form submitting for the whole request round trip', async () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({ status: 201, body: { id: 1, email: 'ada@example.com' }, delay: 500 }));

    const createUser = s.post<CreateUserArgs>('/users');
    const c = s.consumer();
    const submission = c.run(() =>
      createQuerySubmission({ queryCreator: createUser, args: (value: UserModel) => ({ body: value }) }),
    );
    const testForm = c.run(() => form(signal(baseModel()), { submission: { action: submission.action } }));

    expect(testForm().submitting()).toBe(false);

    const submitted = submit(testForm);

    await s.settle();

    expect(testForm().submitting()).toBe(true);
    expect(submission.query.loading()).not.toBeNull();
    expect(s.api.pending().length).toBe(1);

    await s.settle(500);
    await submitted;

    expect(testForm().submitting()).toBe(false);
    expect(submission.query.response()).toEqual({ id: 1, email: 'ada@example.com' });

    c.destroy();
  });

  it('sends no request and resolves the action when args returns null', async () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({ status: 201, body: { id: 1, email: 'ada@example.com' } }));

    const createUser = s.post<CreateUserArgs>('/users');
    const onSuccess = vi.fn();
    const c = s.consumer();
    const submission = c.run(() => createQuerySubmission({ queryCreator: createUser, args: () => null, onSuccess }));
    const testForm = c.run(() => form(signal(baseModel()), { submission: { action: submission.action } }));

    const submitted = submit(testForm);

    await s.settle();
    const success = await submitted;

    expect(s.api.requestCount('POST', '/users')).toBe(0);
    expect(success).toBe(true);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(testForm().errors()).toEqual([]);

    c.destroy();
  });

  it('replaces the default violation mapping with config.mapViolations', async () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({
      status: 422,
      body: { violations: [{ message: 'This value should not be blank.', propertyPath: 'email' }] },
    }));

    const createUser = s.post<CreateUserArgs>('/users');
    const c = s.consumer();
    const submission = c.run(() =>
      createQuerySubmission({
        queryCreator: createUser,
        args: (value: UserModel) => ({ body: value }),
        mapViolations: () => [{ kind: 'appSubmissionError', message: 'mapped by the app' }],
      }),
    );
    const testForm = c.run(() => form(signal(baseModel()), { submission: { action: submission.action } }));

    const submitted = submit(testForm);

    await s.settle();
    await submitted;

    expect(testForm().errors()).toEqual([
      expect.objectContaining({ kind: 'appSubmissionError', message: 'mapped by the app' }),
    ]);
    expect(testForm.email().errors()).toEqual([]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
    c.destroy();
  });

  it('resolves the submit action when the mutation is cancelled mid-flight, instead of leaving the form submitting', async () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({ status: 201, body: { id: 1, email: 'ada@example.com' }, delay: 500 }));

    const createUser = s.post<CreateUserArgs>('/users');
    const onSuccess = vi.fn();
    const c = s.consumer();
    const submission = c.run(() =>
      createQuerySubmission({ queryCreator: createUser, args: (value: UserModel) => ({ body: value }), onSuccess }),
    );
    const testForm = c.run(() => form(signal(baseModel()), { submission: { action: submission.action } }));

    const submitted = submit(testForm);

    await s.settle();

    expect(testForm().submitting()).toBe(true);

    for (const entry of s.client.repository.subtle.cacheEntries()) {
      s.client.repository.subtle.evict(entry.key);
    }

    await s.settle();
    await submitted;

    expect(testForm().submitting()).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(testForm().errors()).toEqual([
      expect.objectContaining({ kind: SERVER_ERROR_KIND, message: 'The request was cancelled.' }),
    ]);
    expect(s.api.pending()).toHaveLength(0);

    c.destroy();
  });

  it('does not reject the submit action when the component is destroyed mid-request', async () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({ status: 201, body: { id: 1, email: 'ada@example.com' }, delay: 500 }));

    const createUser = s.post<CreateUserArgs>('/users');
    const onSuccess = vi.fn();
    const c = s.consumer();
    const submission = c.run(() =>
      createQuerySubmission({ queryCreator: createUser, args: (value: UserModel) => ({ body: value }), onSuccess }),
    );
    const testForm = c.run(() => form(signal(baseModel()), { submission: { action: submission.action } }));

    let rejection: unknown = null;
    const submitted = submit(testForm).catch((error: unknown) => {
      rejection = error;
    });

    await s.settle();

    expect(testForm().submitting()).toBe(true);

    c.destroy();

    await s.settle();
    await submitted;

    expect(rejection).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('validateWithQuery', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

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
    c.destroy();
  });

  it('stops validating once the injector the form was created in is destroyed', async () => {
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
    expect(s.api.requestCount('POST', '/validate')).toBe(1);

    c.destroy();

    testForm.email().value.set('grace@example.com');
    await s.settle();

    expect(s.api.requestCount('POST', '/validate')).toBe(1);
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

    c.destroy();
  });

  it('sends no validation request while a synchronous validator still fails', async () => {
    const s = scenario();
    s.api.on('POST', '/validate', () => ({ status: 204 }));

    const validateEmail = s.post<{ body: { email: string }; response: void }>('/validate');
    const c = s.consumer();
    const testForm = c.run(() => {
      const emailSchema = schema<{ email: string }>((p) => {
        required(p.email);
        validateWithQuery(p.email, {
          queryCreator: validateEmail,
          args: (ctx) => ({ body: { email: ctx.value() } }),
          debounce: 0,
        });
      });

      return form(signal({ email: '' }), emailSchema);
    });

    await s.settle();

    expect(s.api.requestCount('POST', '/validate')).toBe(0);

    testForm.email().value.set('ada@example.com');

    await s.settle();

    expect(s.api.requestCount('POST', '/validate')).toBe(1);

    c.destroy();
  });

  it('sends no request while the when gate is closed, and one once it opens', async () => {
    const s = scenario();
    s.api.on('POST', '/validate', () => ({ status: 204 }));

    const validateEmail = s.post<{ body: { email: string }; response: void }>('/validate');
    const gateOpen = signal(false);
    const c = s.consumer();
    const testForm = c.run(() => {
      const emailSchema = schema<{ email: string }>((p) => {
        validateWithQuery(p.email, {
          queryCreator: validateEmail,
          args: (ctx) => ({ body: { email: ctx.value() } }),
          debounce: 0,
          when: () => gateOpen(),
        });
      });

      return form(signal({ email: 'ada@example.com' }), emailSchema);
    });

    await s.settle();

    expect(s.api.requestCount('POST', '/validate')).toBe(0);
    expect(testForm.email().errors()).toEqual([]);

    gateOpen.set(true);

    await s.settle();

    expect(s.api.requestCount('POST', '/validate')).toBe(1);

    c.destroy();
  });

  it('stops the in-flight validate request when the when gate closes', async () => {
    const s = scenario();
    s.api.on('POST', '/validate', () => ({ status: 204, delay: 500 }));

    const validateEmail = s.post<{ body: { email: string }; response: void }>('/validate');
    const gateOpen = signal(true);
    const c = s.consumer();
    const testForm = c.run(() => {
      const emailSchema = schema<{ email: string }>((p) => {
        validateWithQuery(p.email, {
          queryCreator: validateEmail,
          args: (ctx) => ({ body: { email: ctx.value() } }),
          debounce: 0,
          when: () => gateOpen(),
        });
      });

      return form(signal({ email: 'ada@example.com' }), emailSchema);
    });

    await s.settle();

    expect(s.api.pending()).toHaveLength(1);

    gateOpen.set(false);

    await s.settle();

    expect(s.api.pending()).toHaveLength(0);
    expect(testForm.email().errors()).toEqual([]);

    c.destroy();
  });

  it('uses mapViolations instead of the default field mapping', async () => {
    const s = scenario();
    s.api.on('POST', '/validate', () => ({
      status: 422,
      body: { violations: [{ message: 'Email already taken.', propertyPath: 'email' }] },
    }));

    const validateEmail = s.post<{ body: { email: string }; response: void }>('/validate');
    const c = s.consumer();
    const testForm = c.run(() => {
      const emailSchema = schema<{ email: string }>((p) => {
        validateWithQuery(p.email, {
          queryCreator: validateEmail,
          args: (ctx) => ({ body: { email: ctx.value() } }),
          debounce: 0,
          mapViolations: (violations) =>
            violations.map((violation) => ({ kind: 'appEmailViolation', message: `taken: ${violation.message}` })),
        });
      });

      return form(signal({ email: 'ada@example.com' }), emailSchema);
    });

    await s.settle();

    expect(testForm.email().errors()).toEqual([
      expect.objectContaining({ kind: 'appEmailViolation', message: 'taken: Email already taken.' }),
    ]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
    c.destroy();
  });
});

describe('validateWithV2Query', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('validates a field through a legacy V2Query creator the same way', async () => {
    const s = scenario();
    s.api.on('POST', '/validate', () => ({
      status: 422,
      body: { violations: [{ message: 'Email already taken.', propertyPath: 'email' }] },
    }));

    const expectedErrors = [
      expect.objectContaining({ kind: SERVER_VIOLATION_ERROR_KIND, message: 'Email already taken.' }),
    ];

    const validateEmail = s.post<{ body: { email: string }; response: void }>('/validate');
    const c = s.consumer();
    const legacyClient = c.run(() => new V2QueryClient({ baseRoute: 'https://api.test' }));
    const legacyValidateEmail = legacyClient.post({
      route: '/validate',
      types: { args: def<{ body: { email: string } }>(), response: def<void>() },
    });

    const currentForm = c.run(() => {
      const emailSchema = schema<{ email: string }>((p) => {
        validateWithQuery(p, {
          queryCreator: validateEmail,
          args: (ctx) => ({ body: { email: ctx.value().email } }),
          debounce: 0,
        });
      });

      return form(signal({ email: 'ada@example.com' }), emailSchema);
    });

    const legacyForm = c.run(() => {
      const emailSchema = schema<{ email: string }>((p) => {
        validateWithV2Query(p, {
          queryCreator: legacyValidateEmail,
          args: (ctx) => ({ body: { email: ctx.value().email } }),
          debounce: 0,
        });
      });

      return form(signal({ email: 'ada@example.com' }), emailSchema);
    });

    await s.settle();

    expect(currentForm.email().errors()).toEqual(expectedErrors);
    expect(legacyForm.email().errors()).toEqual(expectedErrors);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
    c.destroy();
  });
});
