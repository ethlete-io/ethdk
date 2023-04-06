import { Paginated } from '@ethlete/types';
import { BehaviorSubject, filter, Observable, of, switchMap, takeWhile } from 'rxjs';
import { transformGql } from '../gql';
import { QueryClient } from '../query-client';
import {
  AnyQueryCreator,
  QueryCreator,
  QueryCreatorArgs,
  QueryCreatorEntity,
  QueryCreatorMethod,
  QueryCreatorResponse,
} from '../query-creator';
import { Method, RequestHeaders, RequestHeadersMethodMap, transformMethod } from '../request';
import {
  AnyGqlQueryConfig,
  AnyQuery,
  AnyQueryCollection,
  AnyQueryCreatorCollection,
  AnyQueryOfCreatorCollection,
  AnyQueryResponseOfCreatorCollection,
  AnyRestQueryConfig,
  BaseArguments,
  Cancelled,
  Failure,
  GqlQueryConfig,
  Loading,
  Prepared,
  QueryResponseType,
  QueryState,
  QueryStateData,
  QueryStateType,
  RouteType,
  Success,
} from './query.types';

type OmitNull<T> = T extends null ? never : T;

export function filterSuccess() {
  return function <T extends QueryState | null, Response extends QueryStateData<OmitNull<T>>>(source: Observable<T>) {
    return source.pipe(filter((value) => isQueryStateSuccess(value))) as Observable<Success<Response>>;
  };
}

export function ignoreAutoRefresh() {
  return function <T extends QueryState | null>(source: Observable<T>) {
    return source.pipe(filter((value) => !isAutoRefresh(value))) as Observable<T>;
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

export function takeUntilResponse(config?: { excludeNull?: boolean }) {
  return function <T extends QueryState | null>(source: Observable<T>) {
    return source.pipe(
      takeWhile((value) => {
        if (config?.excludeNull && value === null) {
          return false;
        }

        return isQueryStateLoading(value) || value === null;
      }, true),
    );
  };
}

export function filterNull() {
  return function <T>(source: Observable<T>) {
    return source.pipe(filter((value): value is OmitNull<T> => value !== null));
  };
}

export function switchQueryState() {
  return function <T extends AnyQuery | null, Response extends QueryResponseType<OmitNull<T>>>(source: Observable<T>) {
    return source.pipe(switchMap((value) => value?.state$ ?? of(null))) as Observable<QueryState<
      OmitNull<Response>
    > | null>;
  };
}

export function switchQueryCollectionState() {
  return function <
    T extends AnyQueryCollection | null,
    Response extends AnyQueryResponseOfCreatorCollection<OmitNull<T>>,
  >(source: Observable<T>) {
    return source.pipe(switchMap((value) => value?.query.state$ ?? of(null))) as Observable<QueryState<
      OmitNull<Response>
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

export const isAutoRefresh = (state: QueryState | null | undefined): boolean => state?.meta.triggeredVia === 'auto';

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
  Entity = unknown,
>(
  config: unknown,
): config is GqlQueryConfig<Route, Response, Arguments, Entity> => {
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

export const extractQuery = <T extends AnyQuery | AnyQueryCollection | null>(v: T) =>
  (isQuery(v) ? v : v?.query) ?? null;

export const getDefaultHeaders = (
  headers: RequestHeaders | RequestHeadersMethodMap | null | undefined,
  method: Method,
) => {
  if (!headers) {
    return {};
  }

  if (method in headers) {
    return (headers[method] ?? {}) as RequestHeaders;
  }

  return headers as RequestHeaders;
};

export const castQueryCreatorTypes = <
  QC extends AnyQueryCreator,
  Arguments extends QueryCreatorArgs<QC>,
  Method extends QueryCreatorMethod<QC>,
  Response extends QueryCreatorResponse<QC>,
  Route extends RouteType<Arguments>,
  Entity extends QueryCreatorEntity<QC>,
  OverrideArguments extends BaseArguments | undefined,
  OverrideResponse extends Response | undefined,
>(config: {
  creator: QC;
  args?: OverrideArguments;
  response?: OverrideResponse;
}) => {
  if (config.args?.pathParams) {
    console.error(config);

    throw new Error('Path params cannot be overridden in castQueryCreatorTypes. Create a new query creator instead.');
  }

  return config.creator as unknown as QueryCreator<OverrideArguments, Method, OverrideResponse, Route, Entity>;
};

export const computeQueryMethod = (config: { config: AnyRestQueryConfig | AnyGqlQueryConfig; client: QueryClient }) => {
  let method: Method;

  if (isGqlQueryConfig(config.config)) {
    const transferVia = config.config.transferVia ?? config.client.config.request?.gql?.transferVia;
    method = transformMethod({ method: config.config.method, transferVia });
  } else {
    method = transformMethod({ method: config.config.method });
  }

  return method;
};

export const computeQueryBody = (config: {
  config: AnyRestQueryConfig | AnyGqlQueryConfig;
  client: QueryClient;
  method: Method;
  args?: BaseArguments;
}) => {
  let body: unknown;

  if (
    config.method === 'GET' ||
    config.method === 'HEAD' ||
    config.method === 'OPTIONS' ||
    (isGqlQueryConfig(config.config) &&
      (config.config.transferVia === 'GET' ||
        (config.client.config.request?.gql?.transferVia === 'GET' && !config.config.transferVia)))
  ) {
    return undefined;
  }

  if (isGqlQueryConfig(config.config)) {
    const queryTemplate = config.config.query;
    const query = transformGql(queryTemplate);

    body = query(config.args?.variables);
  } else {
    body = config.args?.body;
  }

  return body;
};

export const computeQueryAuthHeader = (config: {
  config: AnyRestQueryConfig | AnyGqlQueryConfig;
  client: QueryClient;
}) => {
  let authHeader: Record<string, string> | null = null;

  if (config.config.secure) {
    const header = config.client.authProvider?.header;

    if (header) {
      authHeader = header;
    }
  } else if (config.client.authProvider?.header) {
    if (config.config.secure === undefined || config.config.secure) {
      authHeader = config.client.authProvider.header;
    }
  }

  return authHeader;
};

export const computeQueryHeaders = (config: {
  config: AnyRestQueryConfig | AnyGqlQueryConfig;
  client: QueryClient;
  args?: BaseArguments;
}) => {
  const authHeader = computeQueryAuthHeader(config);

  const mergedHeaders =
    mergeHeaders(
      getDefaultHeaders(config.client.config.request?.headers, config.config.method),
      authHeader,
      config.args?.headers,
    ) || undefined;

  return mergedHeaders;
};

export const computeQueryQueryParams = (config: {
  config: AnyRestQueryConfig | AnyGqlQueryConfig;
  client: QueryClient;
  args?: BaseArguments;
}) => {
  if (
    isGqlQueryConfig(config.config) &&
    (config.config.transferVia === 'GET' ||
      (config.client.config.request?.gql?.transferVia === 'GET' && !config.config.transferVia))
  ) {
    const queryTemplate = config.config.query;
    const query = transformGql(queryTemplate);

    let params = query(config.args?.variables);

    if (config.args?.queryParams) {
      params = { ...params, ...config.args?.queryParams };
    }

    return params;
  }

  return config.args?.queryParams;
};

export const paginatedEntityValueUpdater =
  <
    T extends Paginated<unknown>,
    Args extends BaseArguments,
    Entity,
    J extends T extends Paginated<infer X> ? X : never,
  >(
    findFn: (val: J, entity: Entity) => boolean,
  ) =>
  ({ response, rawResponse, entity }: { rawResponse: T; response: T; args: Args; entity: Entity }) => {
    const indexOfEntityRaw = rawResponse.items.findIndex((item) => findFn(item as J, entity));
    const indexOfEntity = response.items.findIndex((item) => findFn(item as J, entity));

    if (indexOfEntity === -1 || indexOfEntityRaw === -1) {
      return null;
    }

    const newRawResponse = {
      ...rawResponse,
      items: [
        ...rawResponse.items.slice(0, indexOfEntityRaw),
        entity,
        ...rawResponse.items.slice(indexOfEntityRaw + 1),
      ],
    };

    const newResponse = {
      ...response,
      items: [...response.items.slice(0, indexOfEntity), entity, ...response.items.slice(indexOfEntity + 1)],
    };

    return {
      response: newResponse,
      rawResponse: newRawResponse,
    };
  };
