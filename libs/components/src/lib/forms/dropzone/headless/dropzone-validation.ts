import { Signal, signal, WritableSignal } from '@angular/core';
import {
  createManagedMetadataKey,
  metadata,
  PathKind,
  SchemaPath,
  SchemaPathRules,
  validate,
  ValidationError,
} from '@angular/forms/signals';
import { formatFileSize } from './dropzone-entry';

export const DROPZONE_FILE_REJECTION_REASONS = {
  ACCEPT: 'accept',
  MAX_FILE_SIZE: 'maxFileSize',
  MIN_FILE_SIZE: 'minFileSize',
  MAX_FILES: 'maxFiles',
} as const;

export type DropzoneFileRejectionReason =
  (typeof DROPZONE_FILE_REJECTION_REASONS)[keyof typeof DROPZONE_FILE_REJECTION_REASONS];

export type DropzoneFileRejection = {
  file: File;
  reason: DropzoneFileRejectionReason;
};

/** The `kind` of the {@link ValidationError}s produced by {@link dropzoneFiles}. */
export const DROPZONE_FILES_ERROR_KIND = 'dropzoneFiles';

export type DropzoneFileConstraints = {
  /**
   * Accepted file types using the native `accept` attribute semantics
   * (`.png`, `image/png`, `image/*`). Also applied to the native file picker.
   */
  accept?: string;

  /** Maximum size of a single file in bytes. */
  maxFileSize?: number;

  /** Minimum size of a single file in bytes. */
  minFileSize?: number;

  /** Overrides the built-in per-rejection error message (e.g. for i18n). */
  message?: (rejection: DropzoneFileRejection) => string;
};

/**
 * @internal
 * The channel between the {@link dropzoneFiles} schema rule and the dropzone directive:
 * the schema publishes the constraints, the directive publishes the rejected files of
 * the most recent selection.
 */
export type DropzoneFileValidationChannel = {
  constraints: Signal<DropzoneFileConstraints | undefined>;
  rejections: WritableSignal<DropzoneFileRejection[]>;
};

/** @internal Read by the dropzone directive via the bound field's metadata. */
export const DROPZONE_FILE_CONSTRAINTS = /* @__PURE__ */ createManagedMetadataKey<
  DropzoneFileValidationChannel,
  DropzoneFileConstraints
>((_state, data) => ({
  constraints: data,
  rejections: signal<DropzoneFileRejection[]>([]),
}));

export const defaultDropzoneRejectionMessage = (
  rejection: DropzoneFileRejection,
  constraints: DropzoneFileConstraints | undefined,
) => {
  const name = rejection.file.name;

  switch (rejection.reason) {
    case DROPZONE_FILE_REJECTION_REASONS.ACCEPT:
      return `"${name}" has an unsupported file type.`;
    case DROPZONE_FILE_REJECTION_REASONS.MAX_FILE_SIZE:
      return `"${name}" is too large${
        constraints?.maxFileSize !== undefined ? ` (max ${formatFileSize(constraints.maxFileSize)})` : ''
      }.`;
    case DROPZONE_FILE_REJECTION_REASONS.MIN_FILE_SIZE:
      return `"${name}" is too small${
        constraints?.minFileSize !== undefined ? ` (min ${formatFileSize(constraints.minFileSize)})` : ''
      }.`;
    default:
      return `"${name}" was not added (only one file is allowed).`;
  }
};

/**
 * Schema rule that validates the files selected in a dropzone bound to this field.
 *
 * Files violating the constraints are never uploaded; each violation surfaces as a
 * regular validation error (`kind: 'dropzoneFiles'`) on the field until the next
 * selection, removal or clear. Count and emptiness constraints are plain value
 * validation — use `required()`, `minLength()` and `maxLength()` for those.
 *
 * @example
 * ```ts
 * form(model, (s) => {
 *   required(s.media, { message: 'Please upload a file' });
 *   maxLength(s.media, 5, { message: 'Upload at most 5 files' });
 *   dropzoneFiles(s.media, { accept: 'image/*', maxFileSize: 5 * 1024 * 1024 });
 * });
 * ```
 */
export const dropzoneFiles = <TValue, TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<TValue, SchemaPathRules.Supported, TPathKind>,
  constraints: DropzoneFileConstraints | (() => DropzoneFileConstraints),
) => {
  metadata(path, DROPZONE_FILE_CONSTRAINTS, typeof constraints === 'function' ? constraints : () => constraints);

  validate(path, (ctx) => {
    const channel = ctx.state.metadata(DROPZONE_FILE_CONSTRAINTS);

    if (!channel) {
      return undefined;
    }

    const currentConstraints = channel.constraints();

    return channel.rejections().map((rejection): ValidationError.WithoutFieldTree => ({
      kind: DROPZONE_FILES_ERROR_KIND,
      message:
        currentConstraints?.message?.(rejection) ?? defaultDropzoneRejectionMessage(rejection, currentConstraints),
    }));
  });
};
