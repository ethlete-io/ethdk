export type EntityKey = string | number;

export interface EntityStoreConfig {
  name: string;
  logActions?: boolean;
}

export interface InsertFromConfig<
  OriginStoreType,
  OriginKeys extends keyof NonNullable<OriginStoreType>,
  IdFn extends (value: NonNullable<OriginStoreType>) => EntityKey | EntityKey[],
> {
  /**
   * The property key of which the value should be replaced.
   */
  for: OriginKeys;

  /**
   * A function that returns the id of the entity. Can also return an array of ids.
   */
  id: IdFn;
}

export interface RemoveFromConfig<T> {
  /**
   * The where function to select the entities to remove.
   */
  where: (entity: T) => boolean;

  /**
   * A function that returns the id of the entity.
   */
  id: (entity: T) => EntityKey;
}
