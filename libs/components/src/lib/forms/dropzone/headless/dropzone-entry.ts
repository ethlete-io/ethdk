import { createObjectUrlHandle, ObjectUrlHandle, randomId } from '@ethlete/core';
import { computed, Signal } from '@angular/core';
import {
  AnyDropzoneUploadConfig,
  DropzoneExistingFileInfo,
  DropzoneUploadError,
  DropzoneUploadHandle,
} from './dropzone-upload';

export const DROPZONE_ENTRY_STATUSES = {
  UPLOADING: 'uploading',
  SUCCESS: 'success',
  ERROR: 'error',
  EXISTING: 'existing',
} as const;

export type DropzoneEntryStatus = (typeof DROPZONE_ENTRY_STATUSES)[keyof typeof DROPZONE_ENTRY_STATUSES];

export type DropzoneEntrySource<TValue = unknown> = { type: 'file'; file: File } | { type: 'existing'; value: TValue };

export type DropzoneEntry<TValue = unknown> = {
  /** Unique id of this entry. Stable for the lifetime of the entry. */
  id: string;

  /** What this entry was created from - a picked/dropped file or an existing form control value. */
  source: DropzoneEntrySource<TValue>;

  /** Human readable name (file name or resolved from the existing value). */
  name: Signal<string>;

  /** File size in bytes. `null` when unknown. */
  size: Signal<number | null>;

  /** Preview URL (object URL for image files, resolver-provided URL for existing values). */
  previewUrl: Signal<string | null>;

  status: Signal<DropzoneEntryStatus>;

  /** Upload progress in percent. `null` means indeterminate (or not uploading). */
  progress: Signal<number | null>;

  /** The upload error, if the last upload attempt failed. */
  error: Signal<DropzoneUploadError | null>;

  /** The first human readable error message of a failed upload, normalized across query flavors. */
  errorMessage: Signal<string | null>;

  /** The form control value of this entry. `null` until the upload succeeded. */
  value: Signal<TValue | null>;

  /** @internal The upload handle driving this entry. `null` for existing entries. */
  handle: DropzoneUploadHandle<TValue> | null;

  /** @internal Object URL held for the preview, revoked when the entry is disposed. */
  objectUrl: ObjectUrlHandle | null;
};

export type CreateFileDropzoneEntryOptions<TValue> = {
  file: File;
  handle: DropzoneUploadHandle<TValue>;
};

export const createFileDropzoneEntry = <TValue>(
  options: CreateFileDropzoneEntryOptions<TValue>,
): DropzoneEntry<TValue> => {
  const { file, handle } = options;

  const objectUrl = file.type.startsWith('image/') ? createObjectUrlHandle(file) : null;

  const status = computed<DropzoneEntryStatus>(() => {
    switch (handle.state()) {
      case 'success':
        return DROPZONE_ENTRY_STATUSES.SUCCESS;
      case 'error':
        return DROPZONE_ENTRY_STATUSES.ERROR;
      default:
        return DROPZONE_ENTRY_STATUSES.UPLOADING;
    }
  });

  return {
    id: randomId(),
    source: { type: 'file', file },
    name: computed(() => file.name),
    size: computed(() => file.size),
    previewUrl: computed(() => objectUrl?.url ?? null),
    status,
    progress: handle.progress,
    error: handle.error,
    errorMessage: handle.errorMessage,
    value: handle.value,
    handle,
    objectUrl,
  };
};

export type CreateExistingDropzoneEntryOptions<TValue> = {
  value: TValue;
  upload: Signal<AnyDropzoneUploadConfig<TValue>>;
};

export const createExistingDropzoneEntry = <TValue>(
  options: CreateExistingDropzoneEntryOptions<TValue>,
): DropzoneEntry<TValue> => {
  const { value, upload } = options;

  const info = computed<DropzoneExistingFileInfo>(() => upload().resolveExisting?.(value) ?? {});

  return {
    id: randomId(),
    source: { type: 'existing', value },
    name: computed(() => info().name ?? String(value)),
    size: computed(() => info().size ?? null),
    previewUrl: computed(() => info().previewUrl ?? null),
    status: computed(() => DROPZONE_ENTRY_STATUSES.EXISTING),
    progress: computed(() => null),
    error: computed(() => null),
    errorMessage: computed(() => null),
    value: computed(() => value),
    handle: null,
    objectUrl: null,
  };
};

/** Releases all resources held by an entry (object URL, in-flight upload). */
export const disposeDropzoneEntry = <TValue>(entry: DropzoneEntry<TValue>) => {
  entry.objectUrl?.revoke();
  entry.handle?.dispose();
};

/** Checks a file against the native `accept` attribute semantics (`.ext`, `type/subtype`, `type/*`). */
export const isFileAccepted = (file: File, accept: string) => {
  const rules = accept
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);

  if (!rules.length) {
    return true;
  }

  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  return rules.some((rule) => {
    if (rule.startsWith('.')) {
      return name.endsWith(rule);
    }

    if (rule.endsWith('/*')) {
      return type.startsWith(rule.slice(0, -1));
    }

    return type === rule;
  });
};

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Formats a byte count as a short human readable string (e.g. `1.5 MB`). */
export const formatFileSize = (bytes: number) => {
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  const rounded = unitIndex === 0 ? size : Math.round(size * 10) / 10;

  return `${rounded} ${FILE_SIZE_UNITS[unitIndex]}`;
};
