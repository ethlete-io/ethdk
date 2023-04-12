import { HttpStatusCode } from './request.util';

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

export type ParamPrimitive = string | number | boolean | null | undefined;

export type Params = Record<string | number | symbol, ParamPrimitive | ParamArray>;

export type ParamArray = Array<ParamPrimitive>;

export type UnfilteredParamPrimitive = string | number | boolean | null | undefined;

export type QueryParams = {
  [key: string]: UnfilteredParamPrimitive | UnfilteredParamArray | QueryParams;
};

export type PathParams = Record<string, string | number>;

export type UnfilteredParamArray = Array<UnfilteredParamPrimitive>;

export type CacheAdapterFn = (headers: RequestHeaders) => number | null;

export type RequestHeaders = Record<string, string>;

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
