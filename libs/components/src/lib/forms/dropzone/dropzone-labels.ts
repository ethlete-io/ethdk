import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';
import { formatFileSize } from './headless/dropzone-entry';

/** What {@link DropzoneLabels.uploadFailedMessage} is called with. */
export type DropzoneUploadFailedContext = {
  fileName: string;
  /** The server's error message, or `null` when the response carried none. */
  serverMessage: string | null;
  /** The `uploadFailed` label, or the component's `uploadErrorLabel` input when set. */
  uploadFailed: string;
};

/**
 * Every string the dropzone renders or announces itself: the drop prompt, each entry's actions, and the
 * fallback wording for an upload that failed without saying why.
 *
 * The prompt is also replaceable as content (`<et-dropzone>` projects anything you put inside it), which
 * is the route to take when you want different markup rather than different words.
 */
export type DropzoneLabels = {
  /** The drop-target prompt, shown when nothing is projected into the dropzone. */
  prompt: string;
  /** Replaces the prompt while the dropzone is readonly and holds no file. */
  empty: string;
  /** The retry action on a failed entry. */
  retry: string;
  /** Accessible label prefix for an entry's remove action - the file name is appended. */
  remove: string;
  /** Accessible label for the replace action, shown in single-file mode. */
  replaceFile: string;
  /** How a failure with no server message is worded: `"photo.png" failed to upload.` */
  uploadFailed: string;
  /** The full message of a failed upload, rendered below the field. */
  uploadFailedMessage: (context: DropzoneUploadFailedContext) => string;
  /** A file rejected by the `accept` constraint of `dropzoneFiles()`. */
  unsupportedFileType: (fileName: string) => string;
  /** A file rejected by `maxFileSize`. */
  fileTooLarge: (fileName: string, maxFileSize: number | undefined) => string;
  /** A file rejected by `minFileSize`. */
  fileTooSmall: (fileName: string, minFileSize: number | undefined) => string;
  /** An extra file dropped onto a single-file dropzone. */
  tooManyFiles: (fileName: string) => string;
  /** Announced while uploads are in flight. */
  uploading: (count: number) => string;
};

/** The built-in English labels. */
export const DEFAULT_DROPZONE_LABELS: DropzoneLabels = {
  prompt: 'Drag & drop or click to browse',
  empty: 'No files',
  retry: 'Retry',
  remove: 'Remove',
  replaceFile: 'Replace file',
  uploadFailed: 'failed to upload',
  uploadFailedMessage: ({ fileName, serverMessage, uploadFailed }) =>
    serverMessage ? `"${fileName}": ${serverMessage}` : `"${fileName}" ${uploadFailed}.`,
  unsupportedFileType: (fileName) => `"${fileName}" has an unsupported file type.`,
  fileTooLarge: (fileName, maxFileSize) =>
    `"${fileName}" is too large${maxFileSize !== undefined ? ` (max ${formatFileSize(maxFileSize)})` : ''}.`,
  fileTooSmall: (fileName, minFileSize) =>
    `"${fileName}" is too small${minFileSize !== undefined ? ` (min ${formatFileSize(minFileSize)})` : ''}.`,
  tooManyFiles: (fileName) => `"${fileName}" was not added (only one file is allowed).`,
  uploading: (count) => (count === 1 ? 'Uploading 1 file' : `Uploading ${count} files`),
};

const DROPZONE_LABELS_DEF = /* @__PURE__ */ defineLabels<DropzoneLabels>('DROPZONE_LABELS', DEFAULT_DROPZONE_LABELS);

/**
 * Localize the dropzone's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial - whatever you leave out keeps its {@link DEFAULT_DROPZONE_LABELS} value. See {@link defineLabels}
 * for the shape, which every domain in this library shares.
 *
 * @example
 * provideDropzoneLabels({ prompt: 'Datei hierher ziehen oder klicken', retry: 'Erneut versuchen' });
 */
export const provideDropzoneLabels = /* @__PURE__ */ toProvideFn(DROPZONE_LABELS_DEF);
export const injectDropzoneLabels = /* @__PURE__ */ toInjectFn(DROPZONE_LABELS_DEF);
export const DROPZONE_LABELS = /* @__PURE__ */ toToken(DROPZONE_LABELS_DEF);
