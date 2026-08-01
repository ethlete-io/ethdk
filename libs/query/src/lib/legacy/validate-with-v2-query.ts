import { Resource, resource } from '@angular/core';
import { FieldContext, PathKind, SchemaPath, SchemaPathRules, TreeValidationResult } from '@angular/forms/signals';
import { FormViolationView } from '@ethlete/types';
import { Observable, filter, firstValueFrom, take } from 'rxjs';
import { applyQueryAsyncValidator } from '../http/query-validator-core';
import { AnyLegacyQueryCreator } from './interop';
import { AnyV2QueryCreator, QueryDataOf } from './query-creator';
import { V2QueryState, isQueryStateFailure, isQueryStateSuccess } from './query';

// The legacy twin of `../http/validate-with-query.ts` for apps still on the class-based
// `V2QueryClient`. Same signature and behavior; only the query engine differs - it prepares and
// executes a v2/legacy query and awaits its settled `state$`, where the v3 variant awaits a query
// snapshot. The shared error-mapping and `validateAsync` wiring live in `query-validator-core`.

/** The args accepted by the creator's `prepare()` - includes `mock`/`config` extras. */
export type V2PrepareArgsOf<TCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator> = Parameters<
  TCreator['prepare']
>[0];

/** Config for {@link validateWithV2Query}. */
export type ValidateWithV2QueryConfig<
  TCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator,
  TValue,
  TPathKind extends PathKind,
> = {
  /**
   * The legacy query creator to run (from `V2QueryClient`'s `post`/`get`, or a
   * `createLegacyQueryCreator` interop wrapper). A fresh query is prepared and executed for each
   * validate request. Running it through the client is the point: auth, base route, caching and
   * error normalization all apply, unlike a raw `httpResource`.
   */
  queryCreator: TCreator;
  /**
   * Builds the `prepare()` args from the field context. Runs reactively on the field value
   * (debounced), exactly like `validateAsync`'s `params` - e.g.
   * `(ctx) => ({ pathParams: { id }, body: { ...ctx.value() } })`.
   */
  args: (ctx: FieldContext<TValue, TPathKind>) => V2PrepareArgsOf<TCreator>;
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

/** The subset of the v2/legacy query surface the validator drives. */
type PreparedV2Query<TData> = {
  execute: () => void;
  abort: () => void;
  state$: Observable<V2QueryState<TData>>;
};

/**
 * Binds a query-backed async validator to a signal-forms field, adapting a **legacy v2**
 * `@ethlete/query` query into what `validateAsync` consumes - the `V2QueryClient` counterpart of
 * {@link validateWithQuery}, so apps that haven't migrated yet can still validate against the
 * server. The query runs through the client (bearer auth, base route, caching, Symfony error
 * normalization), where a raw `httpResource` would fire unauthenticated and bypass the pipeline.
 *
 * The query is prepared and executed (debounced) as the field value changes, only after the
 * field's synchronous validators pass. A `204` / successful response reports no errors; a
 * `422 FormViolationListView` maps each violation onto its child field by `propertyPath`; a
 * network / other error degrades to a non-swallowed form-level error.
 *
 * Call it from a schema definition, the same place you'd call `validateAsync`:
 *
 * ```ts
 * const schema = schema<OpportunityEmail>((p) => {
 *   validateWithV2Query(p, {
 *     queryCreator: postOpportunityEmailValidate, // hubApiClient.post({ ... })
 *     args: (ctx) => ({ pathParams: { opportunityId }, body: { ...ctx.value() } }),
 *   });
 * });
 * ```
 */
export const validateWithV2Query = <
  TCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator,
  TValue,
  TPathKind extends PathKind = PathKind.Root,
>(
  path: SchemaPath<TValue, SchemaPathRules.Supported, TPathKind>,
  config: ValidateWithV2QueryConfig<TCreator, TValue, TPathKind>,
) => {
  type TParams = V2PrepareArgsOf<TCreator>;
  type TResult = QueryDataOf<TCreator>;

  applyQueryAsyncValidator<TValue, TParams, TResult, TPathKind>(path, {
    params: config.args,
    debounce: config.debounce,
    when: config.when,
    mapViolations: config.mapViolations,
    factory: (params) =>
      resource<TResult | undefined, TParams | undefined>({
        params: () => params(),
        loader: ({ params: prepareArgs, abortSignal }) => {
          // Prepared per request - v2 caches by the prepared args, so a fresh `prepare()` is the
          // legacy idiom (the sibling `selectOptionsFromV2Query` does the same via `queryComputed`).
          const query = config.queryCreator.prepare(prepareArgs) as unknown as PreparedV2Query<TResult>;

          abortSignal.addEventListener('abort', () => query.abort());
          query.execute();

          // Resolve once the query settles. A failure is thrown so it lands in `onError`, where the
          // violations are mapped onto the fields; the underlying `HttpErrorResponse` is thrown so
          // `extractFormViolations` can unwrap the 422 body.
          return firstValueFrom(
            query.state$.pipe(
              filter((state) => isQueryStateSuccess(state) || isQueryStateFailure(state)),
              take(1),
            ),
          ).then((state) => {
            if (isQueryStateFailure(state)) {
              throw state.error.httpErrorResponse;
            }

            return state.response;
          });
        },
      }) as Resource<TResult | undefined>,
  });
};
