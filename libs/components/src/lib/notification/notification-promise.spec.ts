import { ApplicationRef, EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QueryArgs, ReadonlyQuery } from '@ethlete/query';
import { Subject, of, throwError } from 'rxjs';
import '../../test-helpers';
import { NotificationConfig, NotificationManagerConfig } from './notification-config';
import { createNotificationPromiseFn } from './notification-promise';
import { NotificationRef, createNotificationRef } from './notification-ref';

const MANAGER_CONFIG: NotificationManagerConfig = {
  position: 'bottom-end',
  maxVisible: 3,
  defaultDuration: { success: 0, info: 0, loading: 0, error: 0 },
};

type QueryExecutionState = NonNullable<ReturnType<ReadonlyQuery<QueryArgs>['executionState']>>;

describe('notification promise', () => {
  let opened: NotificationConfig[];
  let ref: NotificationRef;

  const flushEffects = () => TestBed.inject(ApplicationRef).tick();

  const promise = () =>
    createNotificationPromiseFn({
      open: (config) => {
        opened.push(config);
        ref = createNotificationRef(config, { managerConfig: MANAGER_CONFIG });

        return ref;
      },
      injector: TestBed.inject(EnvironmentInjector),
    });

  beforeEach(() => {
    opened = [];
    TestBed.configureTestingModule({});
  });

  it('opens as loading, taking a bare string as the title', () => {
    promise()(new Promise<string>(() => undefined), { loading: 'Saving…', success: 'Saved', error: 'Failed' });

    expect(opened).toEqual([{ status: 'loading', title: 'Saving…' }]);
  });

  it('replaces the loading content with the success content, keeping nothing of it', async () => {
    promise()(Promise.resolve({ name: 'Report' }), {
      loading: { title: 'Saving…', message: 'Hold on' },
      success: (value) => ({ title: `Saved ${value.name}` }),
      error: 'Failed',
    });

    await Promise.resolve();

    expect(ref.entry().config).toEqual({ status: 'success', title: 'Saved Report' });
  });

  it('turns into the error content when the promise rejects', async () => {
    promise()(Promise.reject(new Error('nope')), {
      loading: 'Saving…',
      success: 'Saved',
      error: (error) => ({ title: 'Failed', message: (error as Error).message }),
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(ref.entry().config).toEqual({ status: 'error', title: 'Failed', message: 'nope' });
  });

  it('settles an observable on completion, carrying its last value', () => {
    const work = new Subject<number>();

    promise()(work, { loading: 'Working…', success: (value) => `Got ${value}`, error: 'Failed' });

    work.next(1);
    work.next(2);
    expect(ref.entry().config.status).toBe('loading');

    work.complete();

    expect(ref.entry().config).toEqual({ status: 'success', title: 'Got 2' });
  });

  it('treats an observable that completes without emitting as a failure', () => {
    promise()(of<number>(), { loading: 'Working…', success: 'Done', error: 'Nothing came back' });

    expect(ref.entry().config).toEqual({ status: 'error', title: 'Nothing came back' });
  });

  it('reports an observable error without letting it escape', () => {
    promise()(
      throwError(() => new Error('boom')),
      {
        loading: 'Working…',
        success: 'Done',
        error: (error) => `Failed: ${(error as Error).message}`,
      },
    );

    expect(ref.entry().config).toEqual({ status: 'error', title: 'Failed: boom' });
  });

  describe('with a query', () => {
    const createFakeQuery = (initial: QueryExecutionState | null = null) => {
      const executionState = signal<QueryExecutionState | null>(initial);

      return {
        executionState,
        query: { executionState } as unknown as ReadonlyQuery<QueryArgs>,
      };
    };

    const loadingState = (percentage?: number): QueryExecutionState => ({
      type: 'loading',
      hasCachedResponse: false,
      loading: {
        executeTime: 0,
        progress: percentage === undefined ? null : { total: 100, loaded: percentage, percentage, speed: null },
      },
    });

    it('settles on the query’s success, handing the response to the success content', () => {
      const { executionState, query } = createFakeQuery(loadingState());

      promise()(query, { loading: 'Saving…', success: (res) => `Saved ${res.name}`, error: 'Failed' });

      flushEffects();
      expect(ref.entry().config.status).toBe('loading');

      executionState.set({ type: 'success', response: { name: 'Report' } });
      flushEffects();

      expect(ref.entry().config).toEqual({ status: 'success', title: 'Saved Report' });
    });

    it('settles on the query’s failure, handing the error to the error content', () => {
      const { executionState, query } = createFakeQuery(loadingState());

      promise()(query, {
        loading: 'Saving…',
        success: 'Saved',
        error: (error) => `Failed with ${error.code}`,
      });

      executionState.set({
        type: 'failure',
        error: { code: 500, isList: false, error: { message: 'Server Error' } },
      } as QueryExecutionState);
      flushEffects();

      expect(ref.entry().config).toEqual({ status: 'error', title: 'Failed with 500' });
    });

    it('follows the request’s upload progress, but only when the loading content asked for a bar', () => {
      const { executionState, query } = createFakeQuery(loadingState(0));

      promise()(query, { loading: { title: 'Uploading…', progress: 0 }, success: 'Done', error: 'Failed' });

      executionState.set(loadingState(42));
      flushEffects();

      expect(ref.entry().config.progress).toBe(42);
    });

    it('leaves the progress alone when the loading content has no bar', () => {
      const { executionState, query } = createFakeQuery(loadingState(0));

      promise()(query, { loading: 'Uploading…', success: 'Done', error: 'Failed' });

      executionState.set(loadingState(42));
      flushEffects();

      expect(ref.entry().config.progress).toBeUndefined();
    });

    it('stops following once it has settled, so a later execution leaves the notification alone', () => {
      const { executionState, query } = createFakeQuery(loadingState());

      promise()(query, { loading: 'Saving…', success: 'Saved', error: 'Failed' });

      executionState.set({ type: 'success', response: {} });
      flushEffects();

      executionState.set({ type: 'failure', error: { code: 500 } } as QueryExecutionState);
      flushEffects();

      expect(ref.entry().config).toEqual({ status: 'success', title: 'Saved' });
    });

    it('says nothing once the notification has been dismissed', () => {
      const { executionState, query } = createFakeQuery(loadingState());

      promise()(query, { loading: 'Saving…', success: 'Saved', error: 'Failed' });

      ref.dismiss();
      ref.markDismissed();

      executionState.set({ type: 'success', response: {} });
      flushEffects();

      expect(ref.entry().config).toEqual({ status: 'loading', title: 'Saving…' });
    });
  });
});
