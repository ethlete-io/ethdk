/* eslint-disable @typescript-eslint/no-explicit-any */
import { EntityStore } from '../entity';
import {
  AnyLegacyQuery,
  AnyLegacyQueryCreator,
  LegacyArgumentsOfQueryArgs,
  LegacyQuery,
  LegacyQueryCreator,
} from '../interop';
import { V2Query } from '../query/query';
import {
  AnyV2Query,
  BaseArguments,
  EmptyObject,
  V2RouteType,
  WithConfig,
  WithHeaders,
  WithMock,
} from '../query/query.types';
import { V2QueryCreator } from './query-creator';

export type QueryPrepareFn<
  Arguments extends BaseArguments | undefined,
  Response,
  Route extends V2RouteType<Arguments>,
  Store extends EntityStore<unknown>,
  Data,
  Id,
> = Arguments extends BaseArguments
  ? (
      args: Arguments & WithHeaders & WithConfig & WithMock<Response>,
    ) => V2Query<Response, Arguments, Route, Store, Data, Id>
  : (
      args?: (Arguments extends EmptyObject ? Arguments : EmptyObject) & WithHeaders & WithConfig & WithMock<Response>,
    ) => V2Query<Response, Arguments, Route, Store, Data, Id>;

export type AnyV2QueryCreator = V2QueryCreator<any, any, any, any, any, any>;

export type V2QueryArgsOf<T extends AnyV2QueryCreator | AnyV2Query | AnyLegacyQuery | AnyLegacyQueryCreator | null> =
  T extends V2QueryCreator<infer Args, any, any, any, any, any>
    ? Args
    : T extends V2Query<any, infer Args, any, any, any, any>
      ? Args
      : T extends LegacyQuery<any, infer Args, any, any, any, any, any>
        ? Args
        : T extends LegacyQueryCreator<infer Args, any, any, any, any>
          ? LegacyArgumentsOfQueryArgs<Args>
          : never;

export type QueryResponseOf<T extends AnyV2QueryCreator | AnyV2Query | AnyLegacyQuery | AnyLegacyQueryCreator | null> =
  T extends V2QueryCreator<any, infer Response, any, any, any, any>
    ? Response
    : T extends V2Query<infer Response, any, any, any, any, any>
      ? Response
      : T extends LegacyQuery<infer Response, any, any, any, any, any, any>
        ? Response
        : T extends LegacyQueryCreator<any, infer Response, any, any, any>
          ? Response
          : never;

export type QueryRouteOf<T extends AnyV2QueryCreator | AnyV2Query | AnyLegacyQuery | AnyLegacyQueryCreator | null> =
  T extends V2QueryCreator<any, any, infer Route, any, any, any>
    ? Route
    : T extends V2Query<any, any, infer Route, any, any, any>
      ? Route
      : T extends LegacyQuery<any, any, infer Route, any, any, any, any>
        ? Route
        : T extends LegacyQueryCreator<infer Args, any, any, any, any>
          ? V2RouteType<LegacyArgumentsOfQueryArgs<Args>>
          : never;

export type QueryStoreOf<T extends AnyV2QueryCreator | AnyV2Query | AnyLegacyQuery | AnyLegacyQueryCreator | null> =
  T extends V2QueryCreator<any, any, any, infer Store, any, any>
    ? Store
    : T extends V2Query<any, any, any, infer Store, any, any>
      ? Store
      : T extends LegacyQuery<any, any, any, infer Store, any, any, any>
        ? Store
        : T extends LegacyQueryCreator<any, any, infer Store, any, any>
          ? Store
          : never;

export type QueryDataOf<T extends AnyV2QueryCreator | AnyLegacyQuery | AnyLegacyQueryCreator | AnyV2Query | null> =
  T extends V2QueryCreator<any, any, any, any, infer Data, any>
    ? Data
    : T extends V2Query<any, any, any, any, infer Data, any>
      ? Data
      : T extends LegacyQuery<any, any, any, any, infer Data, any, any>
        ? Data
        : T extends LegacyQueryCreator<any, any, any, any, infer Data>
          ? Data
          : never;

export type QueryStoreIdOf<T extends AnyV2QueryCreator | AnyV2Query | AnyLegacyQuery | AnyLegacyQueryCreator | null> =
  T extends V2QueryCreator<any, any, any, any, any, infer StoreId>
    ? StoreId
    : T extends V2Query<any, any, any, any, any, infer StoreId>
      ? StoreId
      : T extends LegacyQuery<any, any, any, any, any, infer StoreId, any>
        ? StoreId
        : T extends LegacyQueryCreator<any, any, any, infer StoreId, any>
          ? StoreId
          : never;

export type ConstructQuery<T extends AnyV2QueryCreator | AnyLegacyQueryCreator> = ReturnType<T['prepare']>;
