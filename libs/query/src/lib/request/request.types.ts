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
  code: number;
  message: string;
  detail: Detail;
  raw: unknown;
}

export type ParamPrimitive = string | number | boolean | null | undefined;

export type Params = Record<string | number | symbol, ParamPrimitive | ParamArray>;

export type ParamArray = Array<ParamPrimitive>;

export type UnfilteredParamPrimitive = string | number | boolean | null | undefined;

export type QueryParams = Record<string | number | symbol, UnfilteredParamPrimitive | UnfilteredParamArray>;

export type PathParams = Record<string, string | number>;

export type UnfilteredParamArray = Array<UnfilteredParamPrimitive>;

export type CacheAdapterFn = (headers: Headers) => number | null;

export type RequestHeaders = Record<string, string>;
