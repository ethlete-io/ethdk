import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { Observable, of } from 'rxjs';
import { vi } from 'vitest';
import { SERVER_ERROR_KIND, SERVER_VIOLATION_ERROR_KIND } from '../http/query-signal-forms';
import { AnyV2QueryCreator } from './query-creator';
import { V2QueryState } from './query';
import { validateWithV2Query } from './validate-with-v2-query';

// The v2 request layer runs on raw `XMLHttpRequest`, so there's no `HttpClient` to intercept with
// `HttpTestingController`. Instead we drive the validator with a fake creator whose `state$` emits
// a controlled settled state - this proves the loader wiring (prepare → execute → await settled →
// throw on failure) and the shared error mapping deterministically.

type Model = { name: string };

const failureState = (body: unknown, status = 422): V2QueryState =>
  ({
    type: 'FAILURE',
    error: {
      url: 'http://localhost/validate',
      status,
      statusText: 'x',
      detail: body,
      httpErrorResponse: new HttpErrorResponse({ error: body, status }),
    },
    meta: {},
  }) as unknown as V2QueryState;

const successState = (): V2QueryState =>
  ({ type: 'SUCCESS', response: undefined, headers: {}, meta: {} }) as unknown as V2QueryState;

const fakeCreator = (state: V2QueryState) => {
  const prepared = { execute: vi.fn(), abort: vi.fn(), state$: of(state) as Observable<V2QueryState> };

  return { prepare: vi.fn(() => prepared), _prepared: prepared } as unknown as AnyV2QueryCreator & {
    _prepared: typeof prepared;
  };
};

describe('validateWithV2Query', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [] });
  });

  const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve));

  const createValidatedForm = (creator: AnyV2QueryCreator) =>
    TestBed.runInInjectionContext(() =>
      form(signal<Model>({ name: 'Ada' }), (p) => {
        validateWithV2Query(p, {
          queryCreator: creator,
          args: (ctx) => ({ body: { name: ctx.value().name } }),
          debounce: 0,
        });
      }),
    );

  const settle = async () => {
    TestBed.tick();
    await flushMicrotasks();
    TestBed.tick();
  };

  it('should prepare + execute the query and map a 422 onto the child field', async () => {
    const creator = fakeCreator(failureState({ violations: [{ message: 'Name is taken', propertyPath: 'name' }] }));

    const testForm = createValidatedForm(creator);

    await settle();

    expect(creator.prepare).toHaveBeenCalledWith({ body: { name: 'Ada' } });
    expect(testForm.name().errors()).toEqual([
      expect.objectContaining({ kind: SERVER_VIOLATION_ERROR_KIND, message: 'Name is taken' }),
    ]);
  });

  it('should report no errors on a successful response', async () => {
    const creator = fakeCreator(successState());

    const testForm = createValidatedForm(creator);

    await settle();

    expect(testForm.name().errors()).toEqual([]);
    expect(testForm().errors()).toEqual([]);
  });

  it('should degrade a non-violation failure to a non-swallowed form-level error', async () => {
    const creator = fakeCreator(failureState({ message: 'Service unavailable' }, 500));

    const testForm = createValidatedForm(creator);

    await settle();

    expect(testForm().errors()).toEqual([expect.objectContaining({ kind: SERVER_ERROR_KIND })]);
  });
});
