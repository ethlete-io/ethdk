import { Resource, Signal } from '@angular/core';
import {
  FieldContext,
  FieldTree,
  LogicFn,
  PathKind,
  SchemaPath,
  SchemaPathRules,
  TreeValidationResult,
  validateAsync,
} from '@angular/forms/signals';
import { FormViolationView } from '@ethlete/types';
import { extractFormViolations, mapViolationsToFormErrors } from './query-signal-forms';

// Shared core for the query-backed async validators (`validateWithQuery` /
// `validateWithV2Query`). Everything except how the query is executed - the `factory` that turns
// the debounced params into a `Resource` - is identical between the v2 and v3 variants, so it is
// factored here and imported by both. This module is intentionally NOT part of the `http` barrel;
// it is internal plumbing consumed by direct path (the legacy variant already imports from `http`).

/** Default debounce (ms) applied before a validate request runs, mirroring `selectOptionsFrom*Query`. */
export const DEFAULT_QUERY_VALIDATION_DEBOUNCE = 300;

/**
 * Turns a failed validate request into field errors - the default `onError` mapping shared by both
 * validators. Reuses the existing `mapViolationsToFormErrors` bridge: a `422` violation list is
 * resolved onto the child fields by `propertyPath`, while a network / non-violation error degrades
 * to a non-swallowed form-level error. A caller-supplied `mapViolations` overrides only the
 * violation → error step (it receives the already-extracted violations).
 */
export const mapQueryValidationError = <TValue, TPathKind extends PathKind>(
  error: unknown,
  ctx: FieldContext<TValue, TPathKind>,
  mapViolations?: (violations: FormViolationView[], ctx: FieldContext<TValue, TPathKind>) => TreeValidationResult,
): TreeValidationResult => {
  // Angular's `resource()` wraps a thrown non-`Error` (our `QueryErrorResponse` / `HttpErrorResponse`)
  // into an `Error` and stashes the original on `.cause`, so unwrap it before extraction.
  const cause = error instanceof Error && error.cause !== undefined ? error.cause : error;

  if (mapViolations) {
    return mapViolations(extractFormViolations(cause), ctx);
  }

  // `ctx.fieldTree` is the (read-only) tree of the validated field; `propertyPath`s resolve against
  // it. The cast bridges `ReadonlyFieldTree` → `FieldTree` - `mapViolationsToFormErrors` only walks
  // and reads the tree, never mutates it.
  return mapViolationsToFormErrors({ fieldTree: ctx.fieldTree as unknown as FieldTree<TValue>, error: cause });
};

/** Config shared by both validators, minus the query engine specifics each variant layers on top. */
export type QueryValidatorCoreConfig<TValue, TParams, TResult, TPathKind extends PathKind> = {
  /** Builds the request params from the field context - runs reactively on the field value. */
  params: (ctx: FieldContext<TValue, TPathKind>) => TParams;
  /**
   * Creates the `Resource` that runs the query for the current (debounced) params. The only piece
   * that differs between the v2 and v3 variants.
   */
  factory: (params: Signal<TParams | undefined>) => Resource<TResult | undefined>;
  /** Debounce before the request runs, in ms. @default {@link DEFAULT_QUERY_VALIDATION_DEBOUNCE} */
  debounce?: number;
  /** Gate the validation - return `false` to skip the request (e.g. an empty or invalid value). */
  when?: LogicFn<TValue, boolean, TPathKind>;
  /** Override the default violation → error mapping. Receives the extracted violation list. */
  mapViolations?: (violations: FormViolationView[], ctx: FieldContext<TValue, TPathKind>) => TreeValidationResult;
};

/**
 * Binds a query-backed async validator to `path` via `validateAsync`. Success (`204` / any `2xx`
 * with no violation body) reports no errors; a failed request is mapped by
 * {@link mapQueryValidationError}. Async validation only runs once the field's synchronous
 * validators pass and while `when` holds - signal forms feeds the `factory` `undefined` params when
 * the request shouldn't run, so the resource stays idle.
 */
export const applyQueryAsyncValidator = <TValue, TParams, TResult, TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<TValue, SchemaPathRules.Supported, TPathKind>,
  config: QueryValidatorCoreConfig<TValue, TParams, TResult, TPathKind>,
) => {
  validateAsync<TValue, TParams, TResult, TPathKind>(path, {
    params: config.params,
    debounce: config.debounce ?? DEFAULT_QUERY_VALIDATION_DEBOUNCE,
    factory: config.factory,
    when: config.when,
    onSuccess: () => null,
    onError: (error, ctx) => mapQueryValidationError(error, ctx, config.mapViolations),
  });
};
