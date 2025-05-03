/* eslint-disable @typescript-eslint/no-explicit-any */
import { EntityStore } from '../entity';
import { Query } from '../query/query';
import {
  AnyQuery,
  BaseArguments,
  EmptyObject,
  RouteType,
  WithConfig,
  WithHeaders,
  WithInjector,
  WithMock,
} from '../query/query.types';
import { QueryCreator } from './query-creator';

export type QueryPrepareFn<
  Arguments extends BaseArguments | undefined,
  Response,
  Route extends RouteType<Arguments>,
  Store extends EntityStore<unknown>,
  Data,
  Id,
> = Arguments extends BaseArguments
  ? (
      args: Arguments & WithHeaders & WithConfig & WithMock<Response> & WithInjector,
    ) => Query<Response, Arguments, Route, Store, Data, Id>
  : (
      args?: (Arguments extends EmptyObject ? Arguments : EmptyObject) &
        WithHeaders &
        WithConfig &
        WithMock<Response> &
        WithInjector,
    ) => Query<Response, Arguments, Route, Store, Data, Id>;

export type AnyQueryCreator = QueryCreator<any, any, any, any, any, any>;

export type QueryArgsOf<T extends AnyQueryCreator | AnyQuery | null> =
  T extends QueryCreator<infer Args, any, any, any, any, any>
    ? Args
    : T extends Query<any, infer Args, any, any, any, any>
      ? Args
      : never;

export type QueryResponseOf<T extends AnyQueryCreator | AnyQuery | null> =
  T extends QueryCreator<any, infer Response, any, any, any, any>
    ? Response
    : T extends Query<infer Response, any, any, any, any, any>
      ? Response
      : never;

export type QueryRouteOf<T extends AnyQueryCreator | AnyQuery | null> =
  T extends QueryCreator<any, any, infer Route, any, any, any>
    ? Route
    : T extends Query<any, any, infer Route, any, any, any>
      ? Route
      : never;

export type QueryStoreOf<T extends AnyQueryCreator | AnyQuery | null> =
  T extends QueryCreator<any, any, any, infer Store, any, any>
    ? Store
    : T extends Query<any, any, any, infer Store, any, any>
      ? Store
      : never;

export type QueryDataOf<T extends AnyQueryCreator | AnyQuery | null> =
  T extends QueryCreator<any, any, any, any, infer Data, any>
    ? Data
    : T extends Query<any, any, any, any, infer Data, any>
      ? Data
      : never;

export type QueryStoreIdOf<T extends AnyQueryCreator | AnyQuery | null> =
  T extends QueryCreator<any, any, any, any, any, infer StoreId>
    ? StoreId
    : T extends Query<any, any, any, any, any, infer StoreId>
      ? StoreId
      : never;

export type ConstructQuery<T extends AnyQueryCreator> = ReturnType<T['prepare']>;
