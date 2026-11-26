/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const deepFreeze = <T extends Record<string, unknown>>(object: T) => {
  // check if object is actually an object or frozen
  if (!object || typeof object !== 'object' || Object.isFrozen(object)) {
    return object;
  }

  // Retrieve the property names defined on object
  const propNames = Object.getOwnPropertyNames(object);

  // Freeze properties before freezing self

  for (const name of propNames) {
    const value = object[name];

    if (value && typeof value === 'object') {
      deepFreeze(value as T);
    }
  }

  return Object.freeze(object);
};
