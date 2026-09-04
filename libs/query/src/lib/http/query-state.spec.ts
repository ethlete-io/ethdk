import { HttpEventType, HttpResponse } from '@angular/common/http';
import { createEnvironmentInjector, DestroyRef, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { HttpRequest } from './http-request';
import { QueryErrorResponse } from './query-error-response';
import { setupQueryState } from './query-state';

describe('setupQueryState', () => {
  const setup = <T>(options: Parameters<typeof setupQueryState>[0] = {}) =>
    TestBed.runInInjectionContext(() => setupQueryState<{ response: T }>(options));

  it('should initialize all signals to null', () => {
    const state = setup();
    expect(state.args()).toBeNull();
    expect(state.response()).toBeNull();
    expect(state.rawResponse()).toBeNull();
    expect(state.loading()).toBeNull();
    expect(state.error()).toBeNull();
    expect(state.latestHttpEvent()).toBeNull();
    expect(state.lastTimeExecutedAt()).toBeNull();
    expect(state.lastTriggeredBy()).toBeNull();
    expect(state.executionState()).toBeNull();
  });

  it('should expose writable signals for args, lastTimeExecutedAt and lastTriggeredBy', () => {
    const state = setup();
    state.args.set({ queryParams: { id: 1 } } as never);
    state.lastTimeExecutedAt.set(12345);
    state.lastTriggeredBy.set('poll');
    expect(state.args()).toEqual({ queryParams: { id: 1 } });
    expect(state.lastTimeExecutedAt()).toBe(12345);
    expect(state.lastTriggeredBy()).toBe('poll');
  });

  it('should apply transformResponse when provided', () => {
    const state = TestBed.runInInjectionContext(() =>
      setupQueryState<{ response: string; rawResponse: number }>({ transformResponse: (raw) => `item-${raw}` }),
    );
    // Set rawResponse directly to simulate a received payload
    state.rawResponse.set(42 as never);
    expect(state.response()).toBe('item-42');
  });

  it('should keep the last good response when a later transformResponse throws', () => {
    const state = TestBed.runInInjectionContext(() =>
      setupQueryState<{ response: string; rawResponse: number }>({
        transformResponse: (raw) => {
          if (raw < 0) throw new Error('unmappable response');

          return `item-${raw}`;
        },
      }),
    );

    state.rawResponse.set(42 as never);
    expect(state.response()).toBe('item-42');

    state.rawResponse.set(-1 as never);
    expect(state.response()).toBe('item-42');
    expect(state.error()?.code).toBe(0);

    state.rawResponse.set(null);
    expect(state.response()).toBeNull();
  });

  it('should leave the response null when the first transformResponse throws', () => {
    const state = TestBed.runInInjectionContext(() =>
      setupQueryState<{ response: string; rawResponse: number }>({
        transformResponse: () => {
          throw new Error('unmappable response');
        },
      }),
    );

    state.rawResponse.set(1 as never);

    expect(state.response()).toBeNull();
    expect(state.error()?.code).toBe(0);
  });

  it('should return the raw response as-is when no transformResponse is provided', () => {
    const state = setup<string>();
    state.rawResponse.set('hello' as never);
    expect(state.response()).toBe('hello');
  });

  it('should report success for an empty response body once the response event arrived', () => {
    const state = setup<string>();

    state.latestHttpEvent.set(new HttpResponse<never>({ status: 204 }));

    expect(state.executionState()).toEqual({ type: 'success', response: null });
  });

  it('should stay null while only the sent event arrived', () => {
    const state = setup<string>();

    state.latestHttpEvent.set({ type: HttpEventType.Sent });

    expect(state.executionState()).toBeNull();
  });

  it.each([false, 0, ''])('should report the falsy cached response %j while loading', (response) => {
    const state = setup<typeof response>();

    state.rawResponse.set(response as never);
    state.loading.set({ executeTime: 1, progress: null });

    expect(state.executionState()).toEqual({
      type: 'loading',
      hasCachedResponse: true,
      loading: { executeTime: 1, progress: null },
      cachedResponse: response,
    });
  });

  it('should include the cached response when a re-execution fails', () => {
    const state = setup<{ id: number }>();
    const error = { code: 500 } as QueryErrorResponse;

    state.rawResponse.set({ id: 1 });
    state.error.set(error);

    expect(state.executionState()).toEqual({
      type: 'failure',
      error,
      hasCachedResponse: true,
      cachedResponse: { id: 1 },
    });
  });

  it('should report when a failure has no cached response', () => {
    const state = setup();
    const error = { code: 500 } as QueryErrorResponse;

    state.error.set(error);

    expect(state.executionState()).toEqual({ type: 'failure', error, hasCachedResponse: false });
  });

  it('should unsubscribe from request events when its injection scope is destroyed', () => {
    const injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    const unsubscribe = vi.fn();
    const events$ = new Observable<never>(() => unsubscribe);
    const state = setupQueryState<{ response: string }>({ destroyRef: injector.get(DestroyRef) });

    state.subtle.bindRequestEvents({ events$ } as unknown as HttpRequest<{ response: string }>);
    injector.destroy();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
