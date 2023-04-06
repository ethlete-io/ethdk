/* eslint-disable @typescript-eslint/no-explicit-any */
import { Query } from '../query/query';
import { BaseArguments, EmptyObject, RouteType, WithHeaders } from '../query/query.types';
import { Method as MethodType } from '../request';
import { QueryCreator } from './query-creator';

export type QueryPrepareFn<
  Arguments extends BaseArguments | undefined,
  Response,
  Route extends RouteType<Arguments>,
  Method extends MethodType,
  Entity,
> = Arguments extends BaseArguments
  ? (args: Arguments & WithHeaders) => Query<Response, Arguments, Route, Method, Entity>
  : (
      args?: (Arguments extends EmptyObject ? Arguments : EmptyObject) & WithHeaders,
    ) => Query<Response, Arguments, Route, Method, Entity>;

export type AnyQueryCreator = QueryCreator<any, any, any, any, any>;

export type QueryCreatorArgs<T extends AnyQueryCreator> = T extends QueryCreator<infer Args, any, any, any, any>
  ? Args
  : never;

export type QueryCreatorMethod<Q extends AnyQueryCreator> = Q extends QueryCreator<any, infer Method, any, any, any>
  ? Method
  : never;

export type QueryCreatorResponse<T extends AnyQueryCreator> = T extends QueryCreator<any, any, infer Response, any, any>
  ? Response
  : never;

export type QueryCreatorRoute<Q extends AnyQueryCreator> = Q extends QueryCreator<infer Args, any, any, any, any>
  ? RouteType<Args>
  : never;

export type QueryCreatorEntity<Q extends AnyQueryCreator> = Q extends QueryCreator<any, any, any, any, infer Entity>
  ? Entity
  : never;

export type QueryCreatorReturnType<T extends AnyQueryCreator> = ReturnType<T['prepare']>;
