import { HttpErrorResponse } from '@angular/common/http';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
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

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type RequestError<Detail = unknown> = {
  url: string;
  status: number;
  statusText: string;
  detail: Detail;
  httpErrorResponse: HttpErrorResponse;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type RequestHeaders = Record<string, string>;
export { BuildQueryStringConfig, PathParams, QueryParams } from '../../http/internal/request-route';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type V2CacheAdapterFn = (headers: RequestHeaders) => number | null;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type RequestHeadersMethodMap = {
  [M in Method]?: RequestHeaders;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type PartialXhrState = {
  headers: RequestHeaders;
  status: number;
  statusText: string;
  url: string;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type RequestRetryFnConfig = {
  error: RequestError;
  headers: RequestHeaders;
  currentRetryCount: number;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type RequestRetryFnResult = {
  retry: boolean;
  delay?: number;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type RequestRetryFn = (config: RequestRetryFnConfig) => RequestRetryFnResult;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type RequestConfig = {
  method: Method;
  urlWithParams: string;
  body?: unknown;
  reportProgress?: boolean;
  withCredentials?: boolean;
  responseType?: 'arraybuffer' | 'blob' | 'json' | 'text';
  headers?: RequestHeaders;
  cacheAdapter?: V2CacheAdapterFn;
  retryFn?: RequestRetryFn;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type RequestProgress = {
  current: number;
  percentage?: number;
  total?: number;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
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
