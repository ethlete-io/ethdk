import { QueryArgs, QueryCreator, RequestArgs, ResponseType } from '@ethlete/query';

/**
 * Display information for a value that is already part of the form control
 * (e.g. media uploaded in a previous session inside an edit form).
 */
export type DropzoneExistingFileInfo = {
  /** URL rendered as a preview thumbnail. */
  previewUrl?: string | null;

  /** Human readable name of the file. Falls back to the stringified value. */
  name?: string;

  /** File size in bytes. */
  size?: number | null;
};

export type DropzoneUploadConfig<TArgs extends QueryArgs = QueryArgs, TValue = unknown> = {
  /**
   * The query creator used to upload a single file (e.g. a POST multipart route).
   *
   * For per-file upload progress, create it with `reportProgress: true` and make sure the
   * app uses the XHR `HttpClient` backend (upload progress events are not supported with
   * `provideHttpClient(withFetch())`). Without progress information the dropzone falls
   * back to an indeterminate progress display.
   */
  queryCreator: QueryCreator<TArgs>;

  /**
   * Builds the request args for one file.
   * Override to change the multipart field name or to add extra fields, path params,
   * query params or headers.
   *
   * @default (file) => ({ body: FormData with the file appended as "file" })
   */
  createArgs?: (file: File) => RequestArgs<TArgs>;

  /**
   * Maps the upload response to the value that gets pushed into the form control
   * (e.g. `(media) => media.uuid`).
   */
  selectValue: (response: NonNullable<ResponseType<TArgs>>) => TValue;

  /**
   * Maps a value that is already part of the form control (edit forms) to display info.
   * Called in a reactive context — reading signals inside it is supported, so async
   * lookups can be modeled as signals updating over time.
   *
   * Required as soon as the form control can start with a non-empty value.
   */
  resolveExisting?: (value: TValue) => DropzoneExistingFileInfo;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDropzoneUploadConfig<TValue = unknown> = DropzoneUploadConfig<any, TValue>;

/**
 * Identity helper that correlates the query args type with the form control value type,
 * so `DropzoneUploadConfig` objects get full type inference at the definition site.
 */
export const createDropzoneUpload = <TArgs extends QueryArgs, TValue>(
  config: DropzoneUploadConfig<TArgs, TValue>,
): DropzoneUploadConfig<TArgs, TValue> => config;

export const createDefaultDropzoneArgs = (file: File): RequestArgs<QueryArgs> => {
  const body = new FormData();
  body.append('file', file, file.name);

  return { body };
};
