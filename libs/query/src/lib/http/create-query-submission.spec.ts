import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, required, submit } from '@angular/forms/signals';
import { createQuerySubmission } from './create-query-submission';
import { createQueryClient } from './query-client';
import { createPostQuery } from './query-creator-templates';

type UserModel = { name: string };

type CreateUserArgs = {
  body: UserModel;
  response: { id: number; name: string };
};

describe('createQuerySubmission', () => {
  const client = createQueryClient({ baseUrl: 'https://example.com', name: 'submission-test' });

  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpTesting = TestBed.inject(HttpTestingController);
  });

  const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve));

  const setup = (config?: { onSuccess?: (response: { id: number; name: string } | null) => void }) => {
    const createUser = createPostQuery(client)<CreateUserArgs>('/users');

    return TestBed.runInInjectionContext(() => {
      const model = signal<UserModel>({ name: 'Ada' });
      const submission = createQuerySubmission({
        queryCreator: createUser,
        args: (value: UserModel) => ({ body: value }),
        onSuccess: (response) => config?.onSuccess?.(response),
      });
      const userForm = form(model, (path) => required(path.name), {
        submission: { action: submission.action },
      });

      return { model, submission, userForm };
    });
  };

  it('should execute the query with args built from the submitted value', async () => {
    const onSuccess = vi.fn();
    const { userForm } = setup({ onSuccess });

    const submitted = submit(userForm);

    TestBed.tick();

    const request = httpTesting.expectOne('https://example.com/users');

    expect(request.request.body).toEqual({ name: 'Ada' });

    request.flush({ id: 1, name: 'Ada' });

    TestBed.tick();
    await flushMicrotasks();
    TestBed.tick();
    await submitted;

    expect(onSuccess).toHaveBeenCalledWith({ id: 1, name: 'Ada' });
    expect(userForm().submitting()).toBe(false);
    expect(userForm().errors()).toEqual([]);
  });

  it('should map a failed request violations onto the field that caused them', async () => {
    const onSuccess = vi.fn();
    const { userForm } = setup({ onSuccess });

    const submitted = submit(userForm);

    TestBed.tick();

    httpTesting
      .expectOne('https://example.com/users')
      .flush(
        { violations: [{ message: 'Name is taken', propertyPath: 'name' }] },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

    TestBed.tick();
    await flushMicrotasks();
    TestBed.tick();
    await submitted;

    expect(onSuccess).not.toHaveBeenCalled();
    expect(
      userForm
        .name()
        .errors()
        .map((error) => error.message),
    ).toEqual(['Name is taken']);
  });

  it('should skip the request when args returns null', async () => {
    const createUser = createPostQuery(client)<CreateUserArgs>('/users');

    const { userForm } = TestBed.runInInjectionContext(() => {
      const model = signal<UserModel>({ name: 'Ada' });
      const submission = createQuerySubmission({
        queryCreator: createUser,
        args: () => null,
      });

      return {
        userForm: form(model, (path) => required(path.name), { submission: { action: submission.action } }),
      };
    });

    const submitted = submit(userForm);

    TestBed.tick();
    await flushMicrotasks();
    await submitted;

    httpTesting.expectNone('https://example.com/users');
    expect(userForm().submitting()).toBe(false);
  });

  it('should not run the action at all while the form is invalid', async () => {
    const createUser = createPostQuery(client)<CreateUserArgs>('/users');
    const args = vi.fn(() => ({ body: { name: '' } }));

    const { userForm } = TestBed.runInInjectionContext(() => {
      const model = signal<UserModel>({ name: '' });
      const submission = createQuerySubmission({ queryCreator: createUser, args });

      return {
        userForm: form(model, (path) => required(path.name), { submission: { action: submission.action } }),
      };
    });

    await submit(userForm);

    expect(args).not.toHaveBeenCalled();
    httpTesting.expectNone('https://example.com/users');
  });

  afterEach(() => httpTesting.verify());
});
