import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { createQueryClient } from './query-client';
import { createPostQuery } from './query-creator-templates';
import { SERVER_ERROR_KIND, SERVER_VIOLATION_ERROR_KIND } from './query-signal-forms';
import { validateWithQuery } from './validate-with-query';

type ValidateArgs = {
  body: { name: string };
  response: void;
};

describe('validateWithQuery', () => {
  const client = createQueryClient({ baseUrl: 'https://example.com', name: 'validate-with-query-test' });

  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpTesting = TestBed.inject(HttpTestingController);
  });

  const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve));

  const createValidatedForm = () => {
    const validateName = createPostQuery(client)<ValidateArgs>('/validate');

    return TestBed.runInInjectionContext(() =>
      form(signal({ name: 'Ada' }), (p) => {
        validateWithQuery(p, {
          queryCreator: validateName,
          args: (ctx) => ({ body: { name: ctx.value().name } }),
          debounce: 0,
        });
      }),
    );
  };

  const settle = async () => {
    TestBed.tick();
    await flushMicrotasks();
    TestBed.tick();
  };

  it('should run the query through the client and map a 422 onto the child field', async () => {
    const testForm = createValidatedForm();

    TestBed.tick();

    httpTesting
      .expectOne('https://example.com/validate')
      .flush(
        { violations: [{ message: 'Name is taken', propertyPath: 'name' }] },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

    await settle();

    expect(testForm.name().errors()).toEqual([
      expect.objectContaining({ kind: SERVER_VIOLATION_ERROR_KIND, message: 'Name is taken' }),
    ]);
  });

  it('should report no errors on a 204 success', async () => {
    const testForm = createValidatedForm();

    TestBed.tick();

    httpTesting.expectOne('https://example.com/validate').flush(null, { status: 204, statusText: 'No Content' });

    await settle();

    expect(testForm.name().errors()).toEqual([]);
    expect(testForm().errors()).toEqual([]);
  });

  it('should degrade a network / server error to a non-swallowed form-level error', async () => {
    const testForm = createValidatedForm();

    TestBed.tick();

    httpTesting
      .expectOne('https://example.com/validate')
      .flush({ message: 'Service unavailable' }, { status: 500, statusText: 'Server Error' });

    await settle();

    expect(testForm().errors()).toEqual([expect.objectContaining({ kind: SERVER_ERROR_KIND })]);
  });
});
