import { HttpErrorResponse } from '@angular/common/http';
import { FieldTree, ReadonlyFieldTree, ValidationError } from '@angular/forms/signals';
import { FormViolationView } from '@ethlete/types';
import { createQueryErrorResponse, isQueryErrorResponse } from './query-error-response';
import { isSymfonyFormViolationListError, isSymfonyListError } from './query-error-response-utils';

/** `kind` of a `ValidationError` created from a single server violation. */
export const SERVER_VIOLATION_ERROR_KIND = 'etServerViolation';

/** `kind` of the form-level fallback error created when a failed request carries no violations. */
export const SERVER_ERROR_KIND = 'etServerError';

/** A signal-forms validation error created from a single server violation. */
export type ServerViolationValidationError = ValidationError.WithOptionalFieldTree & {
  kind: typeof SERVER_VIOLATION_ERROR_KIND;
  message: string;
  /** The violation this error was created from. */
  violation: FormViolationView;
};

/** The form-level fallback error for a failed request that carries no violations. */
export type ServerValidationError = ValidationError.WithOptionalFieldTree & {
  kind: typeof SERVER_ERROR_KIND;
  message: string;
};

/**
 * Extracts the violation list from a failed request in any of the shapes it may reach you:
 * a `QueryErrorResponse` (from `query.error()` or a settled snapshot), a raw `HttpErrorResponse`,
 * an already-unwrapped error body, or a plain violation array. Returns `[]` when the error
 * carries no violations.
 */
export const extractFormViolations = (error: unknown): FormViolationView[] => {
  if (!error) return [];

  const body = isQueryErrorResponse(error) ? error.raw.error : error instanceof HttpErrorResponse ? error.error : error;

  if (isSymfonyFormViolationListError(body)) {
    return body.violations;
  }

  if (isSymfonyListError(body)) {
    return body;
  }

  return [];
};

export type MapViolationsToFormErrorsOptions<TModel> = {
  /**
   * The field tree the violation property paths are resolved against — usually the form root
   * (or the `field` passed to a signal-forms `submit()` action).
   */
  fieldTree: FieldTree<TModel>;

  /**
   * The failed request's error in any shape `extractFormViolations` accepts: a
   * `QueryErrorResponse`, a raw `HttpErrorResponse`, an error body, or a violation array.
   */
  error: unknown;

  /**
   * Rewrites a violation's property path before it is resolved against the field tree — use it
   * when the API's payload shape differs from the form model. Return `null` to treat the
   * violation as unmapped.
   */
  rewritePath?: (path: string, violation: FormViolationView) => string | null;

  /**
   * Overrides how a violation whose path doesn't resolve to a field is turned into an error.
   * Return `null` to drop the violation. By default an unmapped violation becomes a form-level
   * error (no `fieldTree`), which signal forms attaches to the submitted field.
   */
  onUnmappedViolation?: (violation: FormViolationView) => ValidationError.WithOptionalFieldTree | null;
};

/**
 * Maps a failed request's violations onto a signal-forms field tree as validation errors —
 * the bridge between an API's violation list (`@ethlete/types` `FormViolationView`) and
 * signal forms.
 *
 * Each violation's `propertyPath` (e.g. `items[2].name`) is resolved against `fieldTree`; a
 * resolved violation becomes a `ServerViolationValidationError` bound to that field, an
 * unresolved one becomes a form-level error (customizable via `onUnmappedViolation`). A failed
 * request that carries no violations at all degrades to form-level `ServerValidationError`s
 * built from the normalized error message — so returning this function's result from a
 * `submit()` action never silently succeeds on failure.
 *
 * ```ts
 * await submit(this.form, async (field) => {
 *   const snapshot = await executeUntilSettled(this.createPost, { args: { body: field().value() } });
 *   const error = snapshot.error();
 *
 *   if (!error) return;
 *
 *   return mapViolationsToFormErrors({ fieldTree: field, error });
 * });
 * ```
 */
export const mapViolationsToFormErrors = <TModel>(
  options: MapViolationsToFormErrorsOptions<TModel>,
): ValidationError.WithOptionalFieldTree[] => {
  const { fieldTree, error, rewritePath, onUnmappedViolation } = options;

  if (error === null || error === undefined) return [];

  const violations = extractFormViolations(error);

  if (!violations.length) {
    // An empty violation array is an explicit "nothing to map" — only unrecognized error
    // shapes degrade to the form-level fallback.
    if (Array.isArray(error) && !error.length) return [];

    return createFallbackErrors(error);
  }

  const errors: ValidationError.WithOptionalFieldTree[] = [];

  for (const violation of violations) {
    const rawPath = violation.propertyPath;
    const path = rawPath && rewritePath ? rewritePath(rawPath, violation) : rawPath;
    const resolvedFieldTree = path ? resolveFieldTreePath(fieldTree, path) : null;

    if (resolvedFieldTree) {
      const mappedError: ServerViolationValidationError = {
        kind: SERVER_VIOLATION_ERROR_KIND,
        message: violation.message,
        fieldTree: resolvedFieldTree,
        violation,
      };

      errors.push(mappedError);
    } else if (onUnmappedViolation) {
      const customError = onUnmappedViolation(violation);

      if (customError) {
        errors.push(customError);
      }
    } else {
      const unmappedError: ServerViolationValidationError = {
        kind: SERVER_VIOLATION_ERROR_KIND,
        message: violation.message,
        violation,
      };

      errors.push(unmappedError);
    }
  }

  return errors;
};

const createFallbackErrors = (error: unknown): ServerValidationError[] => {
  const queryError = isQueryErrorResponse(error) ? error : createQueryErrorResponse(error);

  if (queryError.isList) {
    return queryError.errors.map((item) => ({ kind: SERVER_ERROR_KIND, message: item.message }));
  }

  return [{ kind: SERVER_ERROR_KIND, message: queryError.error.message }];
};

/** Splits a property path like `items[2].name` or `translations['de'].title` into its segments. */
const parsePropertyPath = (path: string) => {
  return path
    .replace(/\[(['"]?)([^\]]*?)\1\]/g, '.$2')
    .split('.')
    .filter((segment) => segment.length > 0);
};

const resolveFieldTreePath = <TModel>(
  fieldTree: FieldTree<TModel>,
  path: string,
): ReadonlyFieldTree<unknown> | null => {
  let current: unknown = fieldTree;

  for (const segment of parsePropertyPath(path)) {
    if (current === null || (typeof current !== 'object' && typeof current !== 'function')) {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  // A field tree node is callable (calling it returns the field state) — anything else means the
  // path left the tree (e.g. an index past the array's current length).
  return typeof current === 'function' ? (current as ReadonlyFieldTree<unknown>) : null;
};
