import { HttpErrorResponse } from '@angular/common/http';

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

export type RequestError<Detail = unknown> = {
  url: string;
  status: number;
  statusText: string;
  detail: Detail;
  httpErrorResponse: HttpErrorResponse;
};

export type RequestHeaders = Record<string, string>;
export { BuildQueryStringConfig, PathParams, QueryParams } from '../../http/internal/request-route';

export type V2CacheAdapterFn = (headers: RequestHeaders) => number | null;

export type RequestHeadersMethodMap = {
  [M in Method]?: RequestHeaders;
};

export type PartialXhrState = {
  headers: RequestHeaders;
  status: number;
  statusText: string;
  url: string;
};

export type RequestRetryFnConfig = {
  error: RequestError;
  headers: RequestHeaders;
  currentRetryCount: number;
};

export type RequestRetryFnResult = {
  retry: boolean;
  delay?: number;
};

export type RequestRetryFn = (config: RequestRetryFnConfig) => RequestRetryFnResult;

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
