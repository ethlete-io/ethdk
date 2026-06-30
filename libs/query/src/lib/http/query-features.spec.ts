import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, untracked } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { applyQueryFeatures } from './base-query-factory';
import { QueryArgs } from './query';
import { createQueryClient } from './query-client';
import { setupQueryDependencies } from './query-dependencies';
import { createExecuteFn } from './query-execute';
import {
  CLEAR_QUERY_ARGS,
  nestedEffect,
  QueryFeature,
  QueryFeatureContext,
  QueryFeatureFlags,
  QueryFeatureType,
  withArgs,
  withErrorHandling,
  withLogging,
  withResponseUpdate,
  withSuccessHandling,
} from './query-features';
import { setupQueryState } from './query-state';

describe('query features', () => {
  describe('CLEAR_QUERY_ARGS', () => {
    it('should be a Symbol', () => {
      expect(typeof CLEAR_QUERY_ARGS).toBe('symbol');
    });

    it('should be referentially stable (always the same symbol)', () => {
      expect(CLEAR_QUERY_ARGS).toBe(CLEAR_QUERY_ARGS);
    });
  });

  describe('QueryFeatureType', () => {
    it('should contain all expected feature types', () => {
      expect(QueryFeatureType.WITH_ARGS).toBe('WITH_ARGS');
      expect(QueryFeatureType.WITH_POLLING).toBe('WITH_POLLING');
      expect(QueryFeatureType.WITH_AUTO_REFRESH).toBe('WITH_AUTO_REFRESH');
      expect(QueryFeatureType.WITH_LOGGING).toBe('WITH_LOGGING');
      expect(QueryFeatureType.WITH_ERROR_HANDLING).toBe('WITH_ERROR_HANDLING');
      expect(QueryFeatureType.WITH_SUCCESS_HANDLING).toBe('WITH_SUCCESS_HANDLING');
      expect(QueryFeatureType.WITH_RESPONSE_UPDATE).toBe('WITH_RESPONSE_UPDATE');
    });
  });

  describe('nestedEffect', () => {
    it('should run the provided function', () => {
      const calls: number[] = [];
      const src = signal(1);

      TestBed.runInInjectionContext(() => {
        nestedEffect(() => {
          src(); // track
          calls.push(src());
        });
      });

      TestBed.flushEffects();
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  /**
   * Race class B (fixed): no transition is lost when a new execution starts before the previous
   * one's outcome was observed.
   *
   * Historically the side-effect features were edge-triggered `nestedEffect`s bound to the shared,
   * reused `state`, whose `response`/`error`/`latestHttpEvent` `linkedSignal`s get atomically reset
   * when the next execution swaps `state.subtle.request`. A completed execution whose effect had not
   * run yet would lose its transition (mitigated at the time by a global `effectScheduler.flush()`).
   *
   * The features now subscribe to the query-level `state.events$`, fed synchronously from each
   * request's own event stream at the moment each event occurs — so delivery cannot be clobbered by
   * a later execution and needs no flush.
   */
  describe('side-effect feature delivery is loss-free across executions (race class B)', () => {
    const client = createQueryClient({ baseUrl: 'https://example.com', name: 'features-test' });

    const flags: QueryFeatureFlags = {
      hasWithArgsFeature: false,
      shouldAutoExecuteMethod: true,
      shouldAutoExecute: false,
      hasRouteFunction: false,
      method: 'GET',
    };

    let httpTesting: HttpTestingController;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      });
      httpTesting = TestBed.inject(HttpTestingController);
    });

    const buildQuery = () =>
      TestBed.runInInjectionContext(() => {
        const deps = setupQueryDependencies({ client, queryConfig: {} });
        const state = setupQueryState<QueryArgs>({});
        const execute = createExecuteFn<QueryArgs>({
          creator: {},
          creatorInternals: { client, method: 'GET', route: '/items' },
          deps,
          state,
          queryConfig: {},
        });

        const handler = vi.fn();
        const context: QueryFeatureContext<QueryArgs> = { state, execute, deps, flags };
        applyQueryFeatures([withSuccessHandling<QueryArgs>({ handler })], context);

        return { execute, handler };
      });

    const completeRequest = (response: Record<string, unknown>) => {
      const req = httpTesting.expectOne((r) => r.url.includes('/items'));
      req.flush(response);
    };

    it('fires the success handler for both of two rapid executions (re-execute before tick)', () => {
      const { execute, handler } = buildQuery();

      execute({ args: { queryParams: { id: 1 } } });
      completeRequest({ id: 1 });
      // Re-execute before ticking: with the old design this dropped #1's callback.
      execute({ args: { queryParams: { id: 2 } } });
      completeRequest({ id: 2 });

      TestBed.tick();

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, { id: 1 });
      expect(handler).toHaveBeenNthCalledWith(2, { id: 2 });
    });

    it('fires both handlers when the re-execute is triggered from inside an effect', () => {
      // Re-execute issued from inside an ongoing effect flush (as withAutoRefresh / withPolling do).
      const rerun = signal(false);

      const { execute, handler } = TestBed.runInInjectionContext(() => {
        const deps = setupQueryDependencies({ client, queryConfig: {} });
        const state = setupQueryState<QueryArgs>({});
        const exec = createExecuteFn<QueryArgs>({
          creator: {},
          creatorInternals: { client, method: 'GET', route: '/items' },
          deps,
          state,
          queryConfig: {},
        });

        // Re-executing effect registered BEFORE the success handler, so it runs first in a flush.
        nestedEffect(
          () => {
            if (rerun()) {
              untracked(() => exec({ args: { queryParams: { id: 2 } } }));
            }
          },
          { injector: deps.injector },
        );

        const h = vi.fn();
        applyQueryFeatures([withSuccessHandling<QueryArgs>({ handler: h })], { state, execute: exec, deps, flags });

        return { execute: exec, handler: h };
      });

      execute({ args: { queryParams: { id: 1 } } });
      TestBed.tick();
      completeRequest({ id: 1 });

      // Dirty the rerun effect; it re-executes from inside the flush. Delivery via the synchronous
      // per-request `events$` means #1's success is not lost when the request is swapped.
      rerun.set(true);
      TestBed.tick();
      completeRequest({ id: 2 });
      TestBed.tick();

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, { id: 1 });
      expect(handler).toHaveBeenNthCalledWith(2, { id: 2 });
    });
  });

  /**
   * Characterization of the side-effect features' delivery semantics. These pin the CURRENT
   * correct behavior so that a future refactor that removes the global `effectScheduler.flush()`
   * (by binding handlers to per-execution / per-request outcomes instead of the shared, reused
   * `state`) can be verified to preserve every one of these guarantees.
   *
   * If you are doing that refactor: all tests in this block must stay green WITHOUT the
   * `effectScheduler.flush()` calls in the execute factories.
   */
  describe('side-effect feature delivery (characterization)', () => {
    const client = createQueryClient({ baseUrl: 'https://example.com', name: 'features-behavior-test' });

    const flags: QueryFeatureFlags = {
      hasWithArgsFeature: false,
      shouldAutoExecuteMethod: true,
      shouldAutoExecute: false,
      hasRouteFunction: false,
      method: 'GET',
    };

    let httpTesting: HttpTestingController;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      });
      httpTesting = TestBed.inject(HttpTestingController);
    });

    const buildQuery = (features: QueryFeature<QueryArgs>[]) =>
      TestBed.runInInjectionContext(() => {
        const deps = setupQueryDependencies({ client, queryConfig: {} });
        const state = setupQueryState<QueryArgs>({});
        const execute = createExecuteFn<QueryArgs>({
          creator: {},
          creatorInternals: { client, method: 'GET', route: '/items' },
          deps,
          state,
          queryConfig: {},
        });
        applyQueryFeatures(features, { state, execute, deps, flags });
        return { execute, state };
      });

    const flushOk = (response: Record<string, unknown>) => {
      httpTesting.expectOne((r) => r.url.includes('/items')).flush(response);
    };

    const flushError = (status: number) => {
      httpTesting.expectOne((r) => r.url.includes('/items')).flush('err', { status, statusText: 'Error' });
    };

    it('withSuccessHandling fires once per successful execution with the response', () => {
      const handler = vi.fn();
      const { execute } = buildQuery([withSuccessHandling<QueryArgs>({ handler })]);

      execute({ args: { queryParams: { id: 1 } } });
      flushOk({ id: 1 });
      TestBed.tick();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenNthCalledWith(1, { id: 1 });
    });

    it('withErrorHandling fires on a failed execution and withSuccessHandling does not', () => {
      const onError = vi.fn();
      const onSuccess = vi.fn();
      const { execute } = buildQuery([
        withErrorHandling<QueryArgs>({ handler: onError }),
        withSuccessHandling<QueryArgs>({ handler: onSuccess }),
      ]);

      execute({ args: { queryParams: { id: 1 } } });
      flushError(400); // 400 is not retried by the default retry policy
      TestBed.tick();

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('withLogging receives the terminal Response event', () => {
      const logFn = vi.fn();
      const { execute } = buildQuery([withLogging<QueryArgs>({ logFn })]);

      execute({ args: { queryParams: { id: 1 } } });
      flushOk({ id: 1 });
      TestBed.tick();

      expect(logFn).toHaveBeenCalled();
      const sawResponseEvent = logFn.mock.calls.some(([event]) => event?.type === HttpEventType.Response);
      expect(sawResponseEvent).toBe(true);
    });

    it('fires the success handler for two rapid executions with different args', () => {
      const handler = vi.fn();
      const { execute } = buildQuery([withSuccessHandling<QueryArgs>({ handler })]);

      execute({ args: { queryParams: { id: 1 } } });
      flushOk({ id: 1 });
      // re-execute before ticking -> relies on the transition for #1 not being lost
      execute({ args: { queryParams: { id: 2 } } });
      flushOk({ id: 2 });
      TestBed.tick();

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, { id: 1 });
      expect(handler).toHaveBeenNthCalledWith(2, { id: 2 });
    });

    it('fires the success handler again when the same query (cache reuse) is re-executed (polling)', () => {
      const handler = vi.fn();
      const { execute } = buildQuery([withSuccessHandling<QueryArgs>({ handler })]);

      execute({ args: { queryParams: { id: 1 } } });
      flushOk({ value: 'first' });
      TestBed.tick();

      // Same args -> same cache key -> the cached request object is re-executed.
      execute({ args: { queryParams: { id: 1 } } });
      flushOk({ value: 'second' });
      TestBed.tick();

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, { value: 'first' });
      expect(handler).toHaveBeenNthCalledWith(2, { value: 'second' });
    });

    it('withResponseUpdate can override the stored response reactively', () => {
      const override = signal<{ id: number } | null>(null);
      const { execute, state } = buildQuery([
        withResponseUpdate<QueryArgs>({ updater: () => override() }),
      ]);

      execute({ args: { queryParams: { id: 1 } } });
      flushOk({ id: 1 });
      TestBed.tick();
      expect(state.response()).toEqual({ id: 1 });

      // A later reactive update replaces the stored response without a new request.
      override.set({ id: 99 });
      TestBed.tick();
      expect(state.response()).toEqual({ id: 99 });
    });
  });

  /**
   * The second job of `effectScheduler.flush()` (besides handler delivery): when `exec` is called
   * without explicit args, it reads `state.args()`, which is populated by the `withArgs` effect.
   * A pending `withArgs` effect would otherwise be read stale. This pins that an execute() picks up
   * the latest withArgs value.
   */
  describe('withArgs args freshness (characterization)', () => {
    const client = createQueryClient({ baseUrl: 'https://example.com', name: 'features-args-test' });

    const flags: QueryFeatureFlags = {
      hasWithArgsFeature: true,
      shouldAutoExecuteMethod: true,
      shouldAutoExecute: false,
      hasRouteFunction: false,
      onlyManualExecution: true,
      method: 'GET',
    };

    let httpTesting: HttpTestingController;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      });
      httpTesting = TestBed.inject(HttpTestingController);
    });

    it('executes with the latest withArgs value even if execute() is called before the args effect settles', () => {
      const v = signal(1);

      const { execute } = TestBed.runInInjectionContext(() => {
        const deps = setupQueryDependencies({ client, queryConfig: {} });
        const state = setupQueryState<QueryArgs>({});
        const exec = createExecuteFn<QueryArgs>({
          creator: {},
          creatorInternals: { client, method: 'GET', route: '/items' },
          deps,
          state,
          queryConfig: {},
        });
        applyQueryFeatures([withArgs<QueryArgs>(() => ({ queryParams: { v: v() } }))], {
          state,
          execute: exec,
          deps,
          flags,
        });
        return { execute: exec };
      });

      TestBed.tick(); // withArgs sets state.args -> { v: 1 }
      execute();
      httpTesting.expectOne((r) => r.url.includes('v=1')).flush({});
      TestBed.tick();

      // Change args, then execute() WITHOUT explicit args before the withArgs effect has settled.
      v.set(2);
      execute();

      const req = httpTesting.expectOne((r) => r.url.includes('/items'));
      expect(req.request.url).toContain('v=2');
      req.flush({});
    });
  });
});
