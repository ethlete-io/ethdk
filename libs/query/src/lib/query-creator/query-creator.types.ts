/* eslint-disable @typescript-eslint/no-explicit-any */
import { EntityStore } from '../entity';
import { Query } from '../query/query';
import { BaseArguments, EmptyObject, RouteType, WithHeaders } from '../query/query.types';
import { QueryCreator } from './query-creator';

export type QueryPrepareFn<
  Arguments extends BaseArguments | undefined,
  Response,
  Route extends RouteType<Arguments>,
  Store extends EntityStore<unknown>,
  Data,
  Id,
> = Arguments extends BaseArguments
  ? (args: Arguments & WithHeaders) => Query<Response, Arguments, Route, Store, Data, Id>
  : (
      args?: (Arguments extends EmptyObject ? Arguments : EmptyObject) & WithHeaders,
    ) => Query<Response, Arguments, Route, Store, Data, Id>;

export type AnyQueryCreator = QueryCreator<any, any, any, any, any, any>;

export type QueryCreatorArgs<T extends AnyQueryCreator> = T extends QueryCreator<infer Args, any, any, any, any, any>
  ? Args
  : never;

export type QueryCreatorResponse<T extends AnyQueryCreator> = T extends QueryCreator<
  any,
  infer Response,
  any,
  any,
  any,
  any
>
  ? Response
  : never;

export type QueryCreatorRoute<Q extends AnyQueryCreator> = Q extends QueryCreator<any, any, infer Route, any, any, any>
  ? Route
  : never;

export type QueryCreatorStore<Q extends AnyQueryCreator> = Q extends QueryCreator<any, any, any, infer Store, any, any>
  ? Store
  : never;

export type QueryCreatorData<Q extends AnyQueryCreator> = Q extends QueryCreator<any, any, any, any, infer Data, any>
  ? Data
  : never;

export type QueryCreatorId<Q extends AnyQueryCreator> = Q extends QueryCreator<any, any, any, any, any, infer Id>
  ? Id
  : never;

export type QueryCreatorReturnType<T extends AnyQueryCreator> = ReturnType<T['prepare']>;
