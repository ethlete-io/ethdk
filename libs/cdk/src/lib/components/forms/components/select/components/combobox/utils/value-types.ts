/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type Primitive = string | number | boolean | null | undefined | symbol | bigint;
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type Reference = Record<string, unknown> | Array<unknown>;

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const isPrimitiveArray = (value: unknown): value is Array<Primitive> => {
  if (!Array.isArray(value)) return false;

  const first = value[0];
  const last = value[value.length - 1];

  if (!first || !last) return false;

  return typeof first !== 'object' && typeof last !== 'object';
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const isObjectArray = (value: unknown): value is Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) return false;

  const first = value[0];
  const last = value[value.length - 1];

  if (!first || !last) return false;

  return typeof first === 'object' && typeof last === 'object' && !Array.isArray(first) && !Array.isArray(last);
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const isEmptyArray = (value: unknown): value is [] => {
  return Array.isArray(value) && value.length === 0;
};
