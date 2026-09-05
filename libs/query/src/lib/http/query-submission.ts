import { FieldTree, TreeValidationResult } from '@angular/forms/signals';
import { FormViolationView } from '@ethlete/types';
import { Query, RequestArgs, ResponseType } from './query';
import { AnyQueryCreator, QueryArgsOf } from './query-creator';
import { mapViolationsToFormErrors } from './query-signal-forms';
import { executeUntilSettled } from './query-snapshot-utils';

/** Config for {@link createQuerySubmission}. */
export type CreateQuerySubmissionConfig<TCreator extends AnyQueryCreator, TModel> = {
  /**
   * The mutation to submit through (e.g. a `createPostQuery` creator). Like a query stack, the query
   * is created **once**; its args come from each submit rather than from a `withArgs()` feature.
   */
  queryCreator: TCreator;
  /**
   * Builds the request args from the submitted form value. Return `null` to abort the submit without
   * a request - for a value the API has no route for yet, say. Omit it for a route that takes none.
   */
  args?: (value: TModel, field: FieldTree<TModel>) => RequestArgs<QueryArgsOf<TCreator>> | null;
  /**
   * Runs after the request succeeded, before the action resolves and the form leaves its submitting
   * state - notify, close the overlay, navigate.
   */
  onSuccess?: (response: ResponseType<QueryArgsOf<TCreator>>, field: FieldTree<TModel>) => void;
  /**
   * Rewrites a violation's property path before it is resolved against the field tree - use it when
   * the API's payload shape differs from the form model. Return `null` to leave the violation
   * unmapped, so it becomes a form-level error.
   */
  rewritePath?: (path: string, violation: FormViolationView) => string | null;
  /**
   * Override the default violation → error mapping. Receives the failed request's error; return the
   * errors to report. Defaults to `mapViolationsToFormErrors` against the submitted field.
   */
  mapViolations?: (error: unknown, field: FieldTree<TModel>) => TreeValidationResult;
};

export type QuerySubmissionRef<TCreator extends AnyQueryCreator, TModel> = {
  /** The query the submission runs, for an error banner or a retry - never execute it yourself. */
  query: Query<QueryArgsOf<TCreator>>;
  /** The signal form `submission.action`. */
  action: (field: FieldTree<TModel>) => Promise<TreeValidationResult>;
};

/**
 * Builds a signal form's `submission.action` around a mutation: submitting executes the query with
 * args derived from the form's value, waits for it to settle, and maps a failed request's violations
 * back onto the fields that caused them. `form().submitting()` therefore covers the whole round trip.
 *
 * This is the submit-time counterpart to {@link validateWithQuery}. The query's args come from the
 * submitted value rather than a `withArgs()` feature, which also means the query no longer reads the
 * form it belongs to - so it can be declared before it, and no derivation runs per keystroke.
 *
 * ```ts
 * protected createPost = createQuerySubmission({
 *   queryCreator: postPost,
 *   args: (value) => ({ body: value }),
 *   onSuccess: (post) => this.router.navigate(['/posts', post.id]),
 * });
 *
 * protected form = form(this.model, postSchema, {
 *   submission: { action: this.createPost.action },
 * });
 * ```
 *
 * ```html
 * <form [etForm]="form">…</form>
 * <et-query-error [error]="createPost.query.error()" [query]="createPost.query" />
 * ```
 *
 * Call it from an injection context.
 */
export const createQuerySubmission = <TCreator extends AnyQueryCreator, TModel>(
  config: CreateQuerySubmissionConfig<TCreator, TModel>,
): QuerySubmissionRef<TCreator, TModel> => {
  type TArgs = QueryArgsOf<TCreator>;

  // The args reach the query through `execute()`, never `withArgs()`, so a function route has to be
  // told the missing feature is intentional or creating the query throws ET100.
  const query = config.queryCreator({ silenceMissingWithArgsFeatureError: true }) as Query<TArgs>;

  const action = async (field: FieldTree<TModel>): Promise<TreeValidationResult> => {
    const args = config.args?.(field().value(), field) ?? null;

    if (config.args && args === null) return undefined;

    const snapshot = await executeUntilSettled(query, args === null ? undefined : { args });
    const error = snapshot.error();

    if (error) {
      return (
        config.mapViolations?.(error, field) ??
        mapViolationsToFormErrors({ fieldTree: field, error, rewritePath: config.rewritePath })
      );
    }

    config.onSuccess?.(snapshot.response() as ResponseType<TArgs>, field);

    return undefined;
  };

  return { query, action };
};
