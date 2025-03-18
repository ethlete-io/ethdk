import { HttpStatusCode } from '@angular/common/http';

export type Method =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'HEAD'
  | 'OPTIONS'
  | 'TRACE'
  | 'CONNECT'
  | 'PURGE'
  | 'LINK'
  | 'UNLINK'
  | 'GQL_QUERY'
  | 'GQL_MUTATE'
  | 'CUSTOM';

export interface RequestError<Detail = unknown> {
  url: string;
  status: HttpStatusCode;
  statusText: string;
  detail: Detail;
}

export type RequestHeaders = Record<string, string>;
export type QueryParams = object;
export type PathParams = Record<string, string | number>;

export type CacheAdapterFn = (headers: RequestHeaders) => number | null;

export type RequestHeadersMethodMap = {
  [M in Method]?: RequestHeaders;
};

export interface PartialXhrState {
  headers: RequestHeaders;
  status: number;
  statusText: string;
  url: string;
}

export interface RequestRetryFnConfig {
  error: RequestError;
  headers: RequestHeaders;
  currentRetryCount: number;
}

export interface RequestRetryFnResult {
  retry: boolean;
  delay?: number;
}

export type RequestRetryFn = (config: RequestRetryFnConfig) => RequestRetryFnResult;

export interface RequestConfig {
  method: Method;
  urlWithParams: string;
  body?: unknown;
  reportProgress?: boolean;
  withCredentials?: boolean;
  responseType?: 'arraybuffer' | 'blob' | 'json' | 'text';
  headers?: RequestHeaders;
  cacheAdapter?: CacheAdapterFn;
  retryFn?: RequestRetryFn;
}

export type RequestProgress = {
  current: number;
  percentage?: number;
  total?: number;
};

export type RequestEvent<Response = unknown> =
  | {
      type: 'start';
      headers: RequestHeaders;
      isRetry?: boolean;
      retryNumber?: number;
      retryDelay?: number;
    }
  | {
      type: 'delay-retry';
      headers: RequestHeaders;
      retryNumber: number;
      retryDelay: number;
    }
  | {
      type: 'download-progress';
      headers: RequestHeaders;
      progress: RequestProgress;
      partialText?: string;
    }
  | {
      type: 'upload-progress';
      headers: RequestHeaders;
      progress: RequestProgress;
    }
  | {
      type: 'success';
      headers: RequestHeaders;
      response: Response;
      expiresInTimestamp?: number;
    }
  | {
      type: 'failure';
      headers: RequestHeaders;
      error: RequestError;
    }
  | {
      type: 'cancel';
      headers: RequestHeaders;
    };

export interface BuildQueryStringConfig {
  /**
   * Object notation to use for nested objects.
   *
   * @example
   * // dot notation
   * { foo: { bar: 'baz' } } => "foo.bar=baz"
   *
   * @example
   * // bracket notation
   * { foo: { bar: 'baz' } } => "foo[bar]=baz"
   *
   * @example
   * // json-stringify notation
   * { foo: { bar: 'baz' } } => "foo={\"bar\":\"baz\"}"
   *
   * @default 'bracket'
   */
  objectNotation?: 'dot' | 'bracket' | 'json-stringify';

  /**
   * Whether to write array indexes in bracket notation.
   *
   * @example
   * // true
   * { foo: ['bar', 'baz'] } => "foo[0]=bar&foo[1]=baz"
   *
   * @example
   * // false
   * { foo: ['bar', 'baz'] } => "foo[]=bar&foo[]=baz"
   *
   * @default false
   */
  writeArrayIndexes?: boolean;

  /**
   * A list of values that should be ignored when building the query string.
   *
   * Also have a look at `ignoredValuesFns`.
   *
   * @default [undefined, null, Infinity, -Infinity]
   */
  ignoredValues?: Array<unknown>;

  /**
   * A list of functions that should be used to determine whether a value should be ignored when building the query string.
   *
   * Also have a look at `ignoredValues`.
   *
   * @default [isNaN, isEmptyString]
   */
  ignoredValuesFns?: Array<(value: unknown) => boolean>;
}
