import { AnyQueryCreator, QueryArgsOf, QueryHeaders, ResponseType } from '@ethlete/query';
import { Observable, Subject } from 'rxjs';

/** The call state of a toolkit handle, as `@tomtomb/ngrx-toolkit` names it. */
export const CallState = {
  INIT: 'INIT',
  LOADING: 'LOADING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
} as const;

export type CallState = (typeof CallState)[keyof typeof CallState];

/** The error shape of `@tomtomb/ngrx-toolkit`: the HTTP status, the error message and the response body. */
export type ToolkitError<T = unknown> = {
  status: number | string;
  message: string;
  data: T | null;
};

export type ToolkitActionOptions = {
  headers?: QueryHeaders;
  extras?: { skipCache?: boolean };
};

/**
 * The toolkit-shaped args of a query creator: `queryParams` holds the path params, `params` the query string and
 * `body` the body, the way `@tomtomb/ngrx-toolkit` action groups named them.
 */
export type ActionCallArgs<TCreator extends AnyQueryCreator> = {
  [
    K in keyof QueryArgsOf<TCreator> as K extends 'pathParams'
      ? 'queryParams'
      : K extends 'queryParams'
        ? 'params'
        : K extends 'body'
          ? 'body'
          : never
  ]: QueryArgsOf<TCreator>[K];
} & { actionOptions?: ToolkitActionOptions };

export type ToolkitPollingOptions = {
  intervalDuration: number;
  killSwitch: Subject<boolean>;
};

/** The handle `toolkitCall` returns, shaped like the `MappedEntityState` of `@tomtomb/ngrx-toolkit`. */
export type MappedEntityState<TCreator extends AnyQueryCreator> = {
  response$: Observable<ResponseType<QueryArgsOf<TCreator>> | null>;
  cachedResponse$: Observable<ResponseType<QueryArgsOf<TCreator>>>;
  error$: Observable<ToolkitError | null>;
  args$: Observable<ActionCallArgs<TCreator> | null>;
  isInit$: Observable<boolean | null>;
  isLoading$: Observable<boolean | null>;
  isSuccess$: Observable<boolean | null>;
  isError$: Observable<boolean | null>;
  timestamp$: Observable<number | null>;
  callState$: Observable<CallState | null>;
  refresh: () => void;
  remove: () => void;
  startPolling: (options: ToolkitPollingOptions) => void;
  stopPolling: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyMappedEntityState = MappedEntityState<any>;
