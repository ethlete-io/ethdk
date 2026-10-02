import { EffectRef, Injector, effect, untracked } from '@angular/core';
import {
  AnyLegacyQuery,
  isLegacyQuery,
  QueryArgs,
  QueryArgsOf,
  QueryErrorResponse,
  ReadonlyQuery,
  ResponseType,
} from '@ethlete/query';
import { EMPTY, EmptyError, Observable, catchError, isObservable, tap } from 'rxjs';
import {
  NotificationConfig,
  NotificationContentInput,
  NotificationStatus,
  toNotificationContent,
} from './notification-config';
import { NotificationRef } from './notification-ref';

/** What a notification says while work runs, and once it settles. */
export type NotificationPromiseContent<TValue, TError> = {
  loading: NotificationContentInput;

  /** Content for the resolved value. Give a function to read the value, or fixed content to ignore it. */
  success: NotificationContentInput | ((value: TValue) => NotificationContentInput);

  /** Content for the failure. Give a function to read the error, or fixed content to ignore it. */
  error: NotificationContentInput | ((error: TError) => NotificationContentInput);
};

/**
 * Work a notification can follow. An observable settles on completion, carrying its last value -
 * completing without ever emitting counts as a failure, the way `lastValueFrom` treats it.
 */
export type NotificationPromiseWork<TValue> = PromiseLike<TValue> | Observable<TValue>;

/**
 * Opens a `loading` notification and turns it into the success or error one when the work settles -
 * the same notification, updated in place, not a second toast.
 *
 * Takes a promise, an observable, or an `@ethlete/query` query (a `createLegacyQueryCreator` query
 * too). A query is *followed*, never
 * executed: trigger it yourself (or let a GET auto-execute) and the notification mirrors its
 * execution state, settling on the first success or failure it sees. If the query already carries a
 * response by then, the notification skips straight to success.
 *
 * Dismissing the notification detaches it - the work keeps running (dismissing a toast must not
 * cancel a request), it just no longer has anything to say.
 *
 * @example
 * manager.promise(this.api.save(body), {
 *   loading: 'Saving…',
 *   success: (saved) => ({ title: 'Saved', message: saved.name }),
 *   error: () => 'Could not save',
 * });
 *
 * @example
 * this.saveQuery.execute({ args: { body } });
 * manager.promise(this.saveQuery, {
 *   loading: { title: 'Saving…', progress: 0 }, // `progress` follows the request's upload progress
 *   success: 'Saved',
 *   error: (e) => ({ title: 'Could not save', message: e.detail }),
 * });
 */
export type NotificationPromiseFn = {
  <TValue>(
    work: NotificationPromiseWork<TValue>,
    content: NotificationPromiseContent<TValue, unknown>,
  ): NotificationRef;
  <TArgs extends QueryArgs>(
    query: ReadonlyQuery<TArgs>,
    content: NotificationPromiseContent<ResponseType<TArgs>, QueryErrorResponse>,
  ): NotificationRef;
  <TQuery extends AnyLegacyQuery>(
    query: TQuery,
    content: NotificationPromiseContent<ResponseType<QueryArgsOf<TQuery['newQuery']>>, QueryErrorResponse>,
  ): NotificationRef;
};

/** Anything the promise API accepts, before it has been told apart. */
type AnyNotificationPromiseWork = NotificationPromiseWork<unknown> | ReadonlyQuery<QueryArgs> | AnyLegacyQuery;

type RunNotificationPromiseOptions = {
  work: AnyNotificationPromiseWork;
  content: NotificationPromiseContent<never, never>;
  open: (config: NotificationConfig) => NotificationRef;

  /** Injector the query-following effect runs in - `promise()` is called from event handlers, not DI. */
  injector: Injector;
};

const isQuery = (work: NotificationPromiseWork<unknown> | ReadonlyQuery<QueryArgs>): work is ReadonlyQuery<QueryArgs> =>
  typeof work === 'object' && work !== null && 'executionState' in work;

const runNotificationPromise = ({
  content,
  open,
  injector,
  ...options
}: RunNotificationPromiseOptions): NotificationRef => {
  const work = isLegacyQuery<AnyLegacyQuery>(options.work) ? options.work.newQuery : options.work;
  const loading = toNotificationContent(content.loading);
  const ref = open({ ...loading, status: 'loading' });

  const openedReplacementCount = ref.replacementCount();
  const isReplacedByLaterOpen = () => ref.replacementCount() !== openedReplacementCount;

  const updateProgress = (progress: number) => {
    if (isReplacedByLaterOpen()) return;

    ref.update({ progress });
  };

  const settle = (status: Extract<NotificationStatus, 'success' | 'error'>, result: unknown) => {
    if (isReplacedByLaterOpen()) return;

    const source = status === 'success' ? content.success : content.error;
    const resolved =
      typeof source === 'function' ? (source as (value: unknown) => NotificationContentInput)(result) : source;

    ref.replaceConfig({ ...toNotificationContent(resolved), status });
  };

  if (isQuery(work)) {
    followQuery({ query: work, ref, settle, updateProgress, followProgress: loading.progress !== undefined, injector });
  } else if (isObservable(work)) {
    let lastValue: unknown;
    let hasValue = false;

    work
      .pipe(
        tap({
          next: (value) => {
            lastValue = value;
            hasValue = true;
          },
          complete: () => (hasValue ? settle('success', lastValue) : settle('error', new EmptyError())),
        }),
        // The failure belongs to the notification now. Letting it through would surface as an
        // unhandled RxJS error on top of the toast that already reports it.
        catchError((error: unknown) => {
          settle('error', error);

          return EMPTY;
        }),
      )
      .subscribe();
  } else {
    Promise.resolve(work).then(
      (value) => settle('success', value),
      (error: unknown) => settle('error', error),
    );
  }

  return ref;
};

/**
 * Builds the manager's `promise` method. Both public signatures share this one implementation, hence
 * the cast - the overloads exist to type the settle callbacks (a query hands them a
 * `QueryErrorResponse`, everything else an `unknown`), not to pick different code paths.
 */
export const createNotificationPromiseFn = (deps: Omit<RunNotificationPromiseOptions, 'work' | 'content'>) =>
  ((work: AnyNotificationPromiseWork, content: NotificationPromiseContent<never, never>) =>
    runNotificationPromise({ ...deps, work, content })) as NotificationPromiseFn;

const followQuery = ({
  query,
  ref,
  settle,
  updateProgress,
  followProgress,
  injector,
}: {
  query: ReadonlyQuery<QueryArgs>;
  ref: NotificationRef;
  settle: (status: 'success' | 'error', result: unknown) => void;
  updateProgress: (progress: number) => void;
  followProgress: boolean;
  injector: Injector;
}) => {
  let effectRef: EffectRef | null = null;
  let hasSettled = false;

  const stopFollowing = () => {
    effectRef?.destroy();
    effectRef = null;
  };

  effectRef = effect(
    () => {
      const state = query.executionState();

      if (!state || hasSettled) return;

      if (state.type === 'loading') {
        const percentage = state.loading.progress?.percentage;

        if (followProgress && percentage !== undefined) {
          untracked(() => updateProgress(percentage));
        }

        return;
      }

      hasSettled = true;

      untracked(() => {
        if (state.type === 'success') {
          settle('success', state.response);
        } else {
          settle('error', state.error);
        }

        stopFollowing();
      });
    },
    { injector },
  );

  ref.afterDismissed().subscribe(stopFollowing);
};
