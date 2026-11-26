/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type EntityKey = string | number;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type EntityStoreConfig = {
  name: string;
  logActions?: boolean;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type InsertFromConfig<
  OriginStoreType,
  OriginKeys extends keyof NonNullable<OriginStoreType>,
  IdFn extends (value: NonNullable<OriginStoreType>) => EntityKey | EntityKey[],
> = {
  /**
   * The property key of which the value should be replaced.
   */
  for: OriginKeys;

  /**
   * A function that returns the id of the entity. Can also return an array of ids.
   */
  id: IdFn;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type RemoveFromConfig<T> = {
  /**
   * The where function to select the entities to remove.
   */
  where: (entity: T) => boolean;

  /**
   * A function that returns the id of the entity.
   */
  id: (entity: T) => EntityKey;
};
