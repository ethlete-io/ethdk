import { Paginated } from '@ethlete/types';
import { map, of, switchMap, take, tap } from 'rxjs';
import { EntityStore } from './entity-store';
import { EntityKey, InsertFromConfig, RemoveFromConfig } from './entity.types';

export function mapToPaginated<T>(response: Paginated<T>) {
  return map((items) => ({ ...response, items }) as Paginated<T>);
}

// FIXME: This breaks if SubStoreType is an array
/**
 * Use an other store to represent a property of the current entity.
 */
export const insertFrom = <
  OriginStoreType,
  OriginKeys extends keyof NonNullable<OriginStoreType>,
  SubStoreType extends NonNullable<OriginStoreType>[OriginKeys] extends Array<infer U>
    ? U
    : NonNullable<OriginStoreType>[OriginKeys],
  IdFn extends (value: NonNullable<OriginStoreType>) => EntityKey | EntityKey[],
  ComputedEntityType extends ReturnType<IdFn> extends Array<unknown>
    ? OriginStoreType
    : Omit<OriginStoreType, OriginKeys> & { [K in OriginKeys]: SubStoreType | null },
>(
  store: EntityStore<SubStoreType>,
  { for: key, id }: InsertFromConfig<OriginStoreType, OriginKeys, IdFn>,
) =>
  switchMap((value: OriginStoreType) => {
    if (!value) return of(null);

    const ids = id(value);

    if (Array.isArray(ids)) {
      return store.select(ids).pipe(map((data) => ({ ...value, [key]: data }) as ComputedEntityType));
    } else {
      return store.select(ids).pipe(map((data) => ({ ...value, [key]: data }) as ComputedEntityType));
    }
  });

/**
 * Remove entities from a store based on a where function.
 */
export const removeFrom = <T>(store: EntityStore<T>, { where, id }: RemoveFromConfig<T>) => {
  store
    .selectWhere(where)
    .pipe(
      tap((entities) => store.remove(entities.map(id))),
      take(1),
    )
    .subscribe();
};
