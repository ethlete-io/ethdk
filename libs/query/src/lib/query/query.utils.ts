import { BehaviorSubject, filter, Observable, of, switchMap, takeWhile } from 'rxjs';
import { ResponseTransformerType } from '../query-client';
import { RequestHeaders } from '../request';
import {
  AnyQuery,
  AnyQueryCreatorCollection,
  AnyQueryOfCreatorCollection,
  BaseArguments,
  Cancelled,
  Failure,
  GqlQueryConfig,
  Loading,
  Prepared,
  QueryRawResponseType,
  QueryResponseType,
  QueryState,
  QueryStateData,
  QueryStateRawData,
  QueryStateType,
  RouteType,
  Success,
} from './query.types';

type OmitNull<T> = T extends null ? never : T;

export function filterSuccess() {
  return function <
    T extends QueryState | null,
    Response extends QueryStateData<OmitNull<T>>,
    RawResponse extends QueryStateRawData<OmitNull<T>>,
  >(source: Observable<T>) {
    return source.pipe(filter((value) => isQueryStateSuccess(value))) as Observable<Success<Response, RawResponse>>;
  };
}

export function filterFailure() {
  return function <T extends QueryState | null>(source: Observable<T>) {
    return source.pipe(filter((value) => isQueryStateFailure(value))) as Observable<Failure>;
  };
}

export function filterQueryStates(allowedStates: QueryStateType[]) {
  return function <T extends QueryState | null>(source: Observable<T>) {
    return source.pipe(filter((value) => value && allowedStates.includes(value.type))) as Observable<T>;
  };
}

export function takeUntilResponse() {
  return function <T extends QueryState>(source: Observable<T>) {
    return source.pipe(takeWhile((value) => isQueryStateLoading(value), true));
  };
}

export function filterNull() {
  return function <T>(source: Observable<T>) {
    return source.pipe(filter((value): value is OmitNull<T> => value !== null));
  };
}

export function switchQueryState() {
  return function <
    T extends AnyQuery | null,
    Response extends QueryResponseType<OmitNull<T>>,
    RawResponse extends QueryRawResponseType<OmitNull<T>>,
  >(source: Observable<T>) {
    return source.pipe(switchMap((value) => value?.state$ ?? of(null))) as Observable<QueryState<
      OmitNull<Response>,
      OmitNull<RawResponse>
    > | null>;
  };
}

export const isQueryStateLoading = (state: QueryState | null | undefined): state is Loading =>
  state?.type === QueryStateType.Loading;

export const isQueryStateSuccess = (state: QueryState | null | undefined): state is Success =>
  state?.type === QueryStateType.Success;

export const isQueryStateFailure = (state: QueryState | null | undefined): state is Failure =>
  state?.type === QueryStateType.Failure;

export const isQueryStateCancelled = (state: QueryState | null | undefined): state is Cancelled =>
  state?.type === QueryStateType.Cancelled;

export const isQueryStatePrepared = (state: QueryState | null | undefined): state is Prepared =>
  state?.type === QueryStateType.Prepared;

export const mergeHeaders = (...headers: Array<RequestHeaders | null | undefined>) => {
  return headers.reduce((acc, headers) => {
    if (!headers) {
      return acc;
    }

    return {
      ...acc,
      ...headers,
    };
  }, {});
};

export const isGqlQueryConfig = <
  Response,
  Arguments extends BaseArguments | undefined,
  Route extends RouteType<Arguments> | undefined,
  ResponseTransformer extends ResponseTransformerType<Response> | undefined,
>(
  config: unknown,
): config is GqlQueryConfig<Route, Response, Arguments, ResponseTransformer> => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return false;
  }

  if (!('query' in config)) {
    return false;
  }

  return true;
};

export const isQuery = <T extends AnyQuery>(query: unknown): query is T => {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return false;
  }

  if (!('state$' in query)) {
    return false;
  }

  return true;
};

export const createQueryCollection = <T extends AnyQueryCreatorCollection, R extends AnyQueryOfCreatorCollection<T>>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  queryMap: T,
) => new BehaviorSubject<R | null>(null);
