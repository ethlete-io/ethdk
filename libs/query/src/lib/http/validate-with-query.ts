import { Resource, resource } from '@angular/core';
import { FieldContext, PathKind, SchemaPath, SchemaPathRules, TreeValidationResult } from '@angular/forms/signals';
import { FormViolationView } from '@ethlete/types';
import { AnyQueryCreator, QueryArgsOf } from './query-creator';
import { RequestArgs, ResponseType } from './query';
import { executeUntilSettled } from './query-snapshot-utils';
import { applyQueryAsyncValidator } from './query-validator-core';

/** Config for {@link validateWithQuery}. */
export type ValidateWithQueryConfig<TCreator extends AnyQueryCreator, TValue, TPathKind extends PathKind> = {
  /**
   * The query creator to run (e.g. a secure `createPostQuery` validate route). Like a query stack,
   * the query is created **once** and re-executes reactively - never per keystroke. Running it
   * through the query client is the point: auth, base route, caching and error normalization all
   * apply, unlike a raw `httpResource`.
   */
  queryCreator: TCreator;
  /**
   * Builds the request args from the field context. Runs reactively on the field value (debounced),
   * exactly like `validateAsync`'s `params` - e.g.
   * `(ctx) => ({ pathParams: { id }, body: { ...ctx.value() } })`.
   */
  args: (ctx: FieldContext<TValue, TPathKind>) => RequestArgs<QueryArgsOf<TCreator>>;
  /** Debounce before the request runs, in ms. @default 300 */
  debounce?: number;
  /** Gate the validation - return `false` to skip the request (e.g. an empty or invalid value). */
  when?: (ctx: FieldContext<TValue, TPathKind>) => boolean;
  /**
   * Override the default violation → error mapping. Receives the violations extracted from the
   * failed request; return the errors to report (targeting child fields via their `fieldTree`).
   * Defaults to `mapViolationsToFormErrors`, resolving each violation's `propertyPath` against the
   * validated field.
   */
  mapViolations?: (violations: FormViolationView[], ctx: FieldContext<TValue, TPathKind>) => TreeValidationResult;
};

/**
 * Binds a query-backed async validator to a signal-forms field, adapting an `@ethlete/query` v3
 * query into what `validateAsync` consumes. The query runs through the query client - so bearer
 * auth, base route, caching and Symfony error normalization all apply - where a raw `httpResource`
 * would fire unauthenticated and bypass the pipeline.
 *
 * On the current v3 `QueryClient` / `createPostQuery` creators; the `validateWithV2Query` twin
 * covers the legacy `V2QueryClient`. The query is created once and re-executed (debounced) as the
 * field value changes, only after the field's synchronous validators pass. A `204` / successful
 * response reports no errors; a `422 FormViolationListView` maps each violation onto its child
 * field by `propertyPath`; a network / other error degrades to a non-swallowed form-level error.
 *
 * Call it from a schema definition, the same place you'd call `validateAsync`:
 *
 * ```ts
 * const schema = schema<OpportunityEmail>((p) => {
 *   validateWithQuery(p, {
 *     queryCreator: postOpportunityEmailValidate,
 *     args: (ctx) => ({ pathParams: { opportunityId }, body: { ...ctx.value() } }),
 *   });
 * });
 * ```
 */
export const validateWithQuery = <TCreator extends AnyQueryCreator, TValue, TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<TValue, SchemaPathRules.Supported, TPathKind>,
  config: ValidateWithQueryConfig<TCreator, TValue, TPathKind>,
) => {
  type TArgs = QueryArgsOf<TCreator>;
  type TParams = RequestArgs<TArgs>;
  type TResult = ResponseType<TArgs>;

  applyQueryAsyncValidator<TValue, TParams, TResult, TPathKind>(path, {
    params: config.args,
    debounce: config.debounce,
    when: config.when,
    mapViolations: config.mapViolations,
    factory: (params) => {
      // Created once, exactly like a query stack. A POST validate route doesn't auto-execute, so
      // the resource loader drives it - each params change re-executes with the new args. Those args
      // reach the query through `execute()`, never `withArgs()`, so a function route has to be told
      // the missing feature is intentional or creating the query throws ET100.
      const query = config.queryCreator({ silenceMissingWithArgsFeatureError: true });

      return resource<TResult | undefined, TParams | undefined>({
        params: () => params(),
        loader: async ({ params: requestArgs }) => {
          const snapshot = await executeUntilSettled(query, { args: requestArgs as TParams });
          const error = snapshot.error();

          // A failed request (e.g. 422) is thrown so it lands in `onError`, where the violations are
          // mapped onto the fields. A `204` / success settles with no error and no violations.
          if (error) {
            throw error;
          }

          return snapshot.response() ?? undefined;
        },
      }) as Resource<TResult | undefined>;
    },
  });
};
