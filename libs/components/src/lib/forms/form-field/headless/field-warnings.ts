import { createMetadataKey, LogicFn, metadata, PathKind, SchemaPath, SchemaPathRules } from '@angular/forms/signals';

/** The `kind` given to a warning a `warn()` rule returned as a bare string. */
export const FIELD_WARNING_KIND = 'etWarning';

/**
 * A non-blocking advisory about a field's value: the value is accepted and the form still submits,
 * but the user should look at it anyway (a password that meets the rules yet is weak, a date far
 * enough out to be a likely typo, a quantity above what is normally in stock).
 */
export type FieldWarning = {
  /** Machine-readable discriminator. A `FORM_WARNING_MESSAGE_RESOLVER` localizes the text by it. */
  kind: string;

  /** The text shown under the field. Optional when a resolver supplies it from `kind`. */
  message?: string;
};

/** What a {@link warn} rule may return. A bare string becomes a {@link FIELD_WARNING_KIND} warning. */
export type FieldWarningResult = string | FieldWarning | readonly (string | FieldWarning)[] | null | undefined;

/** @internal The channel between the {@link warn} schema rule and the form field. */
export const FIELD_WARNINGS = /* @__PURE__ */ createMetadataKey<readonly FieldWarning[], readonly FieldWarning[]>({
  getInitial: () => [],
  reduce: (accumulated, warnings) => (warnings.length > 0 ? [...accumulated, ...warnings] : accumulated),
});

/** @internal Normalizes what a `warn()` rule or a control's `warnings` input supplied. */
export const toFieldWarnings = (result: FieldWarningResult): readonly FieldWarning[] => {
  if (!result) {
    return [];
  }

  if (typeof result === 'string') {
    return [{ kind: FIELD_WARNING_KIND, message: result }];
  }

  if (!Array.isArray(result)) {
    return [result as FieldWarning];
  }

  return result.flatMap((warning) => toFieldWarnings(warning));
};

/**
 * Schema rule attaching non-blocking warnings to a field. The bound `et-form-field` (or control that
 * renders its own support region) shows them in the place an error would take, in the app's
 * `type: 'warning'` color - but the field stays valid: nothing here reaches validity, `aria-invalid`
 * or submit. An error on the same field takes the slot back until it is fixed.
 *
 * Multiple `warn()` rules on one field are concatenated. Return `null` for no warning.
 *
 * @example
 * ```ts
 * form(model, (s) => {
 *   required(s.password);
 *   warn(s.password, ({ value }) => (isWeak(value()) ? 'This password is easy to guess.' : null));
 *   warn(s.quantity, ({ value }) =>
 *     value() > stock() ? { kind: 'aboveStock', message: 'More than we usually have in stock.' } : null,
 *   );
 * });
 * ```
 */
export const warn = <TValue, TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<TValue, SchemaPathRules.Supported, TPathKind>,
  logic: NoInfer<LogicFn<TValue, FieldWarningResult, TPathKind>>,
) => {
  metadata(path, FIELD_WARNINGS, (ctx) => toFieldWarnings(logic(ctx)));
};
