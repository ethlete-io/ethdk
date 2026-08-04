/**
 * Dummy function for providing types while not breaking inference.
 * **This function always returns null.**
 * @see https://github.com/microsoft/TypeScript/issues/26242
 * @returns null
 *
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const def = <Data>() => null as unknown as Data;
