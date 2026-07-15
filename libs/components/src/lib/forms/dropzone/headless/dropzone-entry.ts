import { randomId } from '@ethlete/core';
import { computed, Signal } from '@angular/core';
import { AnyNewQuery, QueryArgs, QueryErrorResponse, RequestArgs } from '@ethlete/query';
import { AnyDropzoneUploadConfig, DropzoneExistingFileInfo } from './dropzone-upload';

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

  /** What this entry was created from — a picked/dropped file or an existing form control value. */
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
  error: Signal<QueryErrorResponse | null>;

  /** The form control value of this entry. `null` until the upload succeeded. */
  value: Signal<TValue | null>;

  /** @internal The upload query. `null` for existing entries. */
  query: AnyNewQuery | null;

  /** @internal The frozen request args of the upload. Reused for retries. */
  args: RequestArgs<QueryArgs> | null;

  /** @internal Object URL that must be revoked when the entry is disposed. */
  objectUrl: string | null;
};

export type CreateFileDropzoneEntryOptions<TValue> = {
  file: File;
  query: AnyNewQuery;
  args: RequestArgs<QueryArgs>;
  selectValue: (response: unknown) => TValue;
};

export const createFileDropzoneEntry = <TValue>(
  options: CreateFileDropzoneEntryOptions<TValue>,
): DropzoneEntry<TValue> => {
  const { file, query, args, selectValue } = options;

  const objectUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

  const status = computed<DropzoneEntryStatus>(() => {
    const state = query.executionState();

    if (!state) {
      return DROPZONE_ENTRY_STATUSES.UPLOADING;
    }

    switch (state.type) {
      case 'success':
        return DROPZONE_ENTRY_STATUSES.SUCCESS;
      case 'failure':
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
    previewUrl: computed(() => objectUrl),
    status,
    progress: computed(() => query.loading()?.progress?.percentage ?? null),
    error: computed(() => query.error()),
    value: computed(() => {
      const response = query.response();

      return response === null || response === undefined ? null : selectValue(response);
    }),
    query,
    args,
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
    value: computed(() => value),
    query: null,
    args: null,
    objectUrl: null,
  };
};

/** Releases all resources held by an entry (object URL, in-flight upload). */
export const disposeDropzoneEntry = <TValue>(entry: DropzoneEntry<TValue>) => {
  if (entry.objectUrl) {
    URL.revokeObjectURL(entry.objectUrl);
  }

  entry.query?.subtle.destroy();
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
