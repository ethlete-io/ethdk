import { computed, Injector, runInInjectionContext, signal, Signal, untracked } from '@angular/core';
import { filter, firstValueFrom, Observable, of, take } from 'rxjs';
import {
  AnyLegacyQuery,
  AnyLegacyQueryCreator,
  AnyV2Query,
  AnyV2QueryCreator,
  executeUntilSettled,
  extractQuery,
  isQueryStateFailure,
  isQueryStateLoading,
  isQueryStateSuccess,
  QueryArgs,
  QueryCreator,
  QueryDataOf,
  QueryErrorResponse,
  queryStateSignal,
  RequestArgs,
  RequestError,
  ResponseType,
  V2QueryState,
} from '@ethlete/query';

/**
 * Display information for a value that is already part of the form control
 * (e.g. media uploaded in a previous session inside an edit form).
 */
export type DropzoneExistingFileInfo = {
  /** URL rendered as a preview thumbnail. */
  previewUrl?: string | null;

  /** Human readable name of the file. Falls back to the stringified value. */
  name?: string;

  /** File size in bytes. */
  size?: number | null;
};

/**
 * The upload error of a failed entry. Either the new query's `QueryErrorResponse` or the
 * legacy v2 client's `RequestError`, depending on which upload flavor created the entry.
 */
export type DropzoneUploadError = QueryErrorResponse | RequestError;

/** The lifecycle state of a single file upload, abstracted away from the query flavor. */
export type DropzoneUploadState = 'uploading' | 'success' | 'error';

/**
 * @internal
 * A per-file upload handle. It hides which query system runs the upload (the new
 * `@ethlete/query` API or the legacy `V2QueryClient`) behind a uniform set of signals plus
 * `execute`/`dispose`, so the dropzone directive and entry work the same for both flavors.
 */
export type DropzoneUploadHandle<TValue> = {
  /** Current upload lifecycle state. */
  state: Signal<DropzoneUploadState>;

  /** Upload progress in percent. `null` when indeterminate (or not uploading). */
  progress: Signal<number | null>;

  /** The raw upload error of the last failed attempt, kept for `uploadFail` consumers. */
  error: Signal<DropzoneUploadError | null>;

  /** The first human readable error message, normalized across query flavors. */
  errorMessage: Signal<string | null>;

  /** The resolved form control value. `null` until the upload succeeded. */
  value: Signal<TValue | null>;

  /** (Re)runs the upload with the frozen request args. Used for the initial upload and retries. */
  execute: () => void;

  /** Releases the underlying query (aborts an in-flight request). */
  dispose: () => void;
};

/** @internal Options passed to a config's `createUploadHandle`. */
export type DropzoneUploadHandleOptions = {
  file: File;
  injector: Injector;
};

/** @internal Options passed to a config's `executeDelete`. */
export type DropzoneDeleteOptions<TValue> = {
  value: TValue;
  injector: Injector;
};

/**
 * The resolved upload config the dropzone directive consumes. Both `createDropzoneUpload` (new
 * query) and `createV2DropzoneUpload` (legacy v2) produce this shape - the query flavor lives
 * entirely inside `createUploadHandle` / `executeDelete`.
 */
export type ResolvedDropzoneUploadConfig<TValue = unknown> = {
  /**
   * Maps the upload response to the value that gets pushed into the form control
   * (e.g. `(media) => media.uuid`).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectValue: (response: any) => TValue;

  /**
   * Maps a value that is already part of the form control (edit forms) to display info.
   * Called in a reactive context - reading signals inside it is supported, so async
   * lookups can be modeled as signals updating over time.
   *
   * Required as soon as the form control can start with a non-empty value.
   */
  resolveExisting?: (value: TValue) => DropzoneExistingFileInfo;

  /** @internal Creates a per-file upload handle. Set by `createDropzoneUpload` / `createV2DropzoneUpload`. */
  createUploadHandle: (options: DropzoneUploadHandleOptions) => DropzoneUploadHandle<TValue>;

  /**
   * @internal Fires the delete request for an already-persisted value being removed. Unset when
   * the upload config was created without a `delete` option. Resolves with the request error, or
   * `null` on success.
   */
  executeDelete?: (options: DropzoneDeleteOptions<TValue>) => Promise<DropzoneUploadError | null>;

  /** @internal @see DropzoneDeleteConfig.includeExisting */
  deleteIncludesExisting?: boolean;
};

export type AnyDropzoneUploadConfig<TValue = unknown> = ResolvedDropzoneUploadConfig<TValue>;

/**
 * The authoring config for a delete request run when an entry uploaded in this session is removed
 * - e.g. a `DELETE` route that cleans up the uploaded file server-side. Nest it under
 * `DropzoneUploadConfig.delete` / `V2DropzoneUploadConfig.delete`. Removing a still-uploading entry
 * only cancels its upload; nothing was persisted yet, so no delete request is made. A value the
 * control started with is left alone unless `includeExisting` says otherwise.
 */
export type DropzoneDeleteConfig<TArgs extends QueryArgs, TValue> = {
  /** The query creator used to delete one value (e.g. a `DELETE /media/:id` route). */
  queryCreator: QueryCreator<TArgs>;

  /** Builds the request args to delete one value, e.g. `(id) => ({ pathParams: { id } })`. */
  createArgs: (value: TValue) => RequestArgs<TArgs>;

  /**
   * Whether removing a value the control started with - one resolved through `resolveExisting`,
   * rather than uploaded in this session - also deletes it server-side. Off by default: an edit
   * form is usually detaching a record something else owns, not cleaning up after itself. Turn it
   * on where the control owns every value it shows.
   *
   * @default false
   */
  includeExisting?: boolean;
};

/** The authoring config for `createDropzoneUpload` (new `@ethlete/query` API). */
export type DropzoneUploadConfig<
  TArgs extends QueryArgs = QueryArgs,
  TValue = unknown,
  TDeleteArgs extends QueryArgs = QueryArgs,
> = {
  /**
   * The query creator used to upload a single file (e.g. a POST multipart route).
   *
   * For per-file upload progress, create it with `reportProgress: true` and make sure the
   * app uses the XHR `HttpClient` backend (upload progress events are not supported with
   * `provideHttpClient(withFetch())`). Without progress information the dropzone falls
   * back to an indeterminate progress display.
   */
  queryCreator: QueryCreator<TArgs>;

  /**
   * Builds the request args for one file.
   * Override to change the multipart field name or to add extra fields, path params,
   * query params or headers.
   *
   * @default (file) => ({ body: FormData with the file appended as "file" })
   */
  createArgs?: (file: File) => RequestArgs<TArgs>;

  /**
   * Maps the upload response to the value that gets pushed into the form control
   * (e.g. `(media) => media.uuid`).
   */
  selectValue: (response: NonNullable<ResponseType<TArgs>>) => TValue;

  /**
   * Maps a value that is already part of the form control (edit forms) to display info.
   * Called in a reactive context - reading signals inside it is supported, so async
   * lookups can be modeled as signals updating over time.
   *
   * Required as soon as the form control can start with a non-empty value.
   */
  resolveExisting?: (value: TValue) => DropzoneExistingFileInfo;

  /**
   * Run when an entry uploaded in this session is removed - and, with `includeExisting`, when a
   * value the control started with is removed too.
   * Absent: removing an entry only updates the control locally, with no server-side cleanup.
   */
  delete?: DropzoneDeleteConfig<TDeleteArgs, TValue>;
};

/** The args accepted by a legacy v2 creator's `prepare()` - includes `mock`/`config` extras. */
export type V2DropzonePrepareArgsOf<TCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator> = Parameters<
  TCreator['prepare']
>[0];

/** The legacy `V2QueryClient` counterpart of `DropzoneDeleteConfig` - see there for behavior. */
export type V2DropzoneDeleteConfig<TCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator, TValue> = {
  /** The legacy query creator used to delete one value (from `V2QueryClient`'s `delete`). */
  queryCreator: TCreator;

  /** Builds the `prepare()` args to delete one value, e.g. `(id) => ({ pathParams: { id } })`. */
  createArgs: (value: TValue) => V2DropzonePrepareArgsOf<TCreator>;

  /** @see DropzoneDeleteConfig.includeExisting */
  includeExisting?: boolean;
};

/**
 * The authoring config for `createV2DropzoneUpload` - the legacy `V2QueryClient` counterpart of
 * `DropzoneUploadConfig`, for apps that haven't migrated to the new `@ethlete/query` API yet.
 */
export type V2DropzoneUploadConfig<
  TCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator,
  TValue,
  TDeleteCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator = TCreator,
> = {
  /**
   * The legacy query creator used to upload a single file (from `V2QueryClient`'s `post`/`put`,
   * or a `createLegacyQueryCreator` interop wrapper). A fresh query is prepared and executed per
   * file, and re-prepared on retry.
   *
   * For per-file upload progress, create it with `reportProgress: true` and make sure the app
   * uses the XHR `HttpClient` backend. Without progress information the dropzone falls back to an
   * indeterminate progress display.
   */
  queryCreator: TCreator;

  /**
   * Builds the `prepare()` args for one file.
   * Override to change the multipart field name or to add extra fields, path params,
   * query params or headers.
   *
   * @default (file) => ({ body: FormData with the file appended as "file" })
   */
  createArgs?: (file: File) => V2DropzonePrepareArgsOf<TCreator>;

  /**
   * Maps the upload response to the value that gets pushed into the form control
   * (e.g. `(media) => media.uuid`).
   */
  selectValue: (response: NonNullable<QueryDataOf<TCreator>>) => TValue;

  /**
   * Maps a value that is already part of the form control (edit forms) to display info.
   * Called in a reactive context - reading signals inside it is supported, so async
   * lookups can be modeled as signals updating over time.
   *
   * Required as soon as the form control can start with a non-empty value.
   */
  resolveExisting?: (value: TValue) => DropzoneExistingFileInfo;

  /**
   * Run when an entry uploaded in this session is removed - and, with `includeExisting`, when a
   * value the control started with is removed too.
   * Absent: removing an entry only updates the control locally, with no server-side cleanup.
   */
  delete?: V2DropzoneDeleteConfig<TDeleteCreator, TValue>;
};

const firstNewQueryErrorMessage = (error: QueryErrorResponse): string | null => {
  const message = error.isList ? error.errors[0]?.message : error.error?.message;

  return message ?? null;
};

const firstV2ErrorMessage = (error: RequestError): string | null => {
  const detail = error.detail;

  if (typeof detail === 'object' && detail !== null) {
    if ('message' in detail && typeof detail.message === 'string') {
      return detail.message;
    }

    if ('detail' in detail && typeof detail.detail === 'string') {
      return detail.detail;
    }
  }

  if (typeof detail === 'string') {
    return detail;
  }

  return error.statusText || null;
};

const buildFileFormDataBody = (file: File) => {
  const body = new FormData();
  body.append('file', file, file.name);

  return { body };
};

export const createDefaultDropzoneArgs = (file: File): RequestArgs<QueryArgs> => buildFileFormDataBody(file);

const createNewQueryUploadHandle = <TArgs extends QueryArgs, TValue>(
  options: DropzoneUploadHandleOptions & {
    queryCreator: QueryCreator<TArgs>;
    createArgs?: (file: File) => RequestArgs<TArgs>;
    selectValue: (response: NonNullable<ResponseType<TArgs>>) => TValue;
  },
): DropzoneUploadHandle<TValue> => {
  const { file, injector, queryCreator, createArgs, selectValue } = options;

  const query = queryCreator({ injector, silenceMissingWithArgsFeatureError: true });
  const args = (createArgs ?? (createDefaultDropzoneArgs as (file: File) => RequestArgs<TArgs>))(file);

  const state = computed<DropzoneUploadState>(() => {
    const executionState = query.executionState();

    switch (executionState?.type) {
      case 'success':
        return 'success';
      case 'failure':
        return 'error';
      default:
        return 'uploading';
    }
  });

  return {
    state,
    progress: computed(() => query.loading()?.progress?.percentage ?? null),
    error: computed(() => query.error()),
    errorMessage: computed(() => {
      const error = query.error();

      return error ? firstNewQueryErrorMessage(error) : null;
    }),
    value: computed(() => {
      const response = query.response();

      return response === null || response === undefined ? null : selectValue(response);
    }),
    execute: () => query.execute({ args }),
    dispose: () => query.subtle.destroy(),
  };
};

const createV2QueryUploadHandle = <TCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator, TValue>(
  options: DropzoneUploadHandleOptions & {
    queryCreator: TCreator;
    createArgs?: (file: File) => V2DropzonePrepareArgsOf<TCreator>;
    selectValue: (response: NonNullable<QueryDataOf<TCreator>>) => TValue;
  },
): DropzoneUploadHandle<TValue> =>
  // `queryStateSignal` sets up a `toObservable` subscription and thus needs an injection context.
  // The handle is created lazily per file (outside the directive's constructor), so wrap it here.
  runInInjectionContext(options.injector, () => {
    const { file, injector, queryCreator, createArgs, selectValue } = options;

    const args = (createArgs ?? (buildFileFormDataBody as (file: File) => V2DropzonePrepareArgsOf<TCreator>))(file);
    const currentQuery = signal<AnyV2Query | AnyLegacyQuery | null>(null);
    const state = queryStateSignal(currentQuery);

    const releaseCurrent = () => {
      // `abort()` cancels an in-flight request (both a genuine `V2Query` and the legacy interop query).
      // We deliberately do not call the legacy `destroy()` - it re-enters through the underlying query's
      // own `destroyRef` hook and double-destroys the injector (NG0205). The child injector is released
      // when the owning component injector is torn down.
      untracked(currentQuery)?.abort();
    };

    return {
      state: computed<DropzoneUploadState>(() => {
        const current = state();

        if (isQueryStateSuccess(current)) {
          return 'success';
        }

        if (isQueryStateFailure(current)) {
          return 'error';
        }

        return 'uploading';
      }),
      progress: computed(() => {
        const current = state();

        return isQueryStateLoading(current) ? (current.progress?.percentage ?? null) : null;
      }),
      error: computed(() => {
        const current = state();

        return isQueryStateFailure(current) ? current.error : null;
      }),
      errorMessage: computed(() => {
        const current = state();

        return isQueryStateFailure(current) ? firstV2ErrorMessage(current.error) : null;
      }),
      value: computed(() => {
        const current = state();

        return isQueryStateSuccess(current)
          ? selectValue(current.response as NonNullable<QueryDataOf<TCreator>>)
          : null;
      }),
      execute: () => {
        releaseCurrent();
        // Legacy interop creators call `inject(Injector)` inside `prepare()`, so run in context.
        const query = runInInjectionContext(
          injector,
          // `skipCache: true` forces the upload to run - uploads are uncacheable, and the legacy
          // interop query rejects the default `allowCache: true` on an uncacheable request (ET301).
          () => queryCreator.prepare(args).execute({ skipCache: true }) as AnyV2Query | AnyLegacyQuery,
        );
        currentQuery.set(query);
      },
      dispose: () => {
        releaseCurrent();
        currentQuery.set(null);
      },
    };
  });

const createNewQueryDeleteExecutor = <TArgs extends QueryArgs, TValue>(config: {
  queryCreator: QueryCreator<TArgs>;
  createArgs: (value: TValue) => RequestArgs<TArgs>;
}) => {
  const { queryCreator, createArgs } = config;

  return (options: DropzoneDeleteOptions<TValue>): Promise<DropzoneUploadError | null> => {
    const { value, injector } = options;

    const query = queryCreator({ injector, silenceMissingWithArgsFeatureError: true });
    const args = createArgs(value);

    return executeUntilSettled(query, { args })
      .then((snapshot) => snapshot.error())
      .finally(() => query.subtle.destroy());
  };
};

const createV2QueryDeleteExecutor = <TCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator, TValue>(config: {
  queryCreator: TCreator;
  createArgs: (value: TValue) => V2DropzonePrepareArgsOf<TCreator>;
}) => {
  const { queryCreator, createArgs } = config;

  return (options: DropzoneDeleteOptions<TValue>): Promise<DropzoneUploadError | null> =>
    runInInjectionContext(options.injector, () => {
      const { value, injector } = options;
      const args = createArgs(value);

      // Legacy interop creators call `inject(Injector)` inside `prepare()`, so run in context.
      const query = runInInjectionContext(
        injector,
        // `skipCache: true` forces the delete to run - deletes are uncacheable, and the legacy
        // interop query rejects the default `allowCache: true` on an uncacheable request (ET301).
        () => queryCreator.prepare(args).execute({ skipCache: true }) as AnyV2Query | AnyLegacyQuery,
      );

      const state$: Observable<V2QueryState | null> = extractQuery(query)?.state$ ?? of(null);

      return firstValueFrom(
        state$.pipe(
          filter((state) => isQueryStateSuccess(state) || isQueryStateFailure(state)),
          take(1),
        ),
      ).then((state) => (isQueryStateFailure(state) ? state.error : null));
    });
};

/**
 * Builds a dropzone upload config from a **new `@ethlete/query`** query creator. Pass the result
 * to the dropzone's `upload` input.
 *
 * For apps still on the legacy `V2QueryClient`, use {@link createV2DropzoneUpload} instead.
 */
export const createDropzoneUpload = <TArgs extends QueryArgs, TValue, TDeleteArgs extends QueryArgs = QueryArgs>(
  config: DropzoneUploadConfig<TArgs, TValue, TDeleteArgs>,
): AnyDropzoneUploadConfig<TValue> => ({
  selectValue: config.selectValue as (response: unknown) => TValue,
  resolveExisting: config.resolveExisting,
  createUploadHandle: (options) =>
    createNewQueryUploadHandle({
      ...options,
      queryCreator: config.queryCreator,
      createArgs: config.createArgs,
      selectValue: config.selectValue,
    }),
  executeDelete: config.delete
    ? createNewQueryDeleteExecutor({ queryCreator: config.delete.queryCreator, createArgs: config.delete.createArgs })
    : undefined,
  deleteIncludesExisting: config.delete?.includeExisting ?? false,
});

/**
 * The legacy `V2QueryClient` counterpart of {@link createDropzoneUpload}. Builds a dropzone upload
 * config from a legacy v2 query creator (or a `createLegacyQueryCreator` interop wrapper), so apps
 * that haven't migrated to the new query API can still use the dropzone. Pass the result to the
 * same `upload` input.
 *
 * ```ts
 * upload = createV2DropzoneUpload({
 *   queryCreator: client.post({ route: '/media', types: { … }, reportProgress: true }),
 *   selectValue: (media) => media.uuid,
 * });
 * ```
 */
export const createV2DropzoneUpload = <
  TCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator,
  TValue,
  TDeleteCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator = TCreator,
>(
  config: V2DropzoneUploadConfig<TCreator, TValue, TDeleteCreator>,
): AnyDropzoneUploadConfig<TValue> => ({
  selectValue: config.selectValue as (response: unknown) => TValue,
  resolveExisting: config.resolveExisting,
  createUploadHandle: (options) =>
    createV2QueryUploadHandle({
      ...options,
      queryCreator: config.queryCreator,
      createArgs: config.createArgs,
      selectValue: config.selectValue,
    }),
  executeDelete: config.delete
    ? createV2QueryDeleteExecutor({ queryCreator: config.delete.queryCreator, createArgs: config.delete.createArgs })
    : undefined,
  deleteIncludesExisting: config.delete?.includeExisting ?? false,
});
