import { effect, Injector, untracked } from '@angular/core';
import { catchError, EMPTY, isObservable, Observable, Subscription, take, tap } from 'rxjs';
import { AnyDropzoneUploadConfig } from '../../dropzone/headless';

/**
 * Uploads one file and resolves to the URL the editor should point at. The simple shape: anything
 * that produces a URL - an `HttpClient` call, a query's response stream, a plain promise.
 */
export type RichTextEditorImageUploadFn = (file: File) => Observable<string> | PromiseLike<string>;

/**
 * How the image tool uploads. Either an upload function, or a dropzone upload config built with
 * `createDropzoneUpload` / `createV2DropzoneUpload` - the config route reuses the dropzone's
 * per-file query machinery, which is what gives the placeholder real upload progress.
 */
export type RichTextEditorImageUpload = RichTextEditorImageUploadFn | AnyDropzoneUploadConfig<string>;

/** Why an image never made it into the editor. */
export type RichTextEditorImageFailureReason = 'unsupported-type' | 'too-large' | 'upload-failed';

export type RichTextEditorImageFailure = {
  file: File;
  reason: RichTextEditorImageFailureReason;
  /** The upload's own error, for `'upload-failed'` only. */
  error?: unknown;
  /** A human-readable message when the upload provided one. */
  message?: string | null;
};

/** A single upload in flight, reported back to whoever placed the placeholder. */
export type RichTextEditorImageUploadRun = {
  /** Stops reporting and releases the underlying query/subscription. */
  cancel: () => void;
};

export type StartImageUploadOptions = {
  file: File;
  upload: RichTextEditorImageUpload;
  injector: Injector;
  /** Percentage 0–100, or `null` while the upload reports no progress. */
  onProgress: (percentage: number | null) => void;
  onSuccess: (url: string) => void;
  onError: (error: unknown, message: string | null) => void;
};

const isDropzoneUploadConfig = (upload: RichTextEditorImageUpload): upload is AnyDropzoneUploadConfig<string> =>
  typeof upload === 'object' && upload !== null && 'createUploadHandle' in upload;

/**
 * Runs one image upload, whichever flavor the consumer configured, and reports progress/outcome
 * through plain callbacks - so the tool doesn't care whether a query or a promise is behind it.
 */
export const startImageUpload = (options: StartImageUploadOptions): RichTextEditorImageUploadRun => {
  const { file, upload, injector, onProgress, onSuccess, onError } = options;

  if (isDropzoneUploadConfig(upload)) {
    return runQueryUpload({ file, upload, injector, onProgress, onSuccess, onError });
  }

  const result = upload(file);

  if (isObservable(result)) {
    const subscription: Subscription = result
      .pipe(
        take(1),
        tap((url) => onSuccess(url)),
        // The failure is the tool's to report (it removes the placeholder); rethrowing it would
        // surface as an unhandled RxJS error on top of that.
        catchError((error: unknown) => {
          onError(error, errorMessageOf(error));

          return EMPTY;
        }),
      )
      .subscribe();

    return { cancel: () => subscription.unsubscribe() };
  }

  let cancelled = false;

  Promise.resolve(result).then(
    (url) => {
      if (!cancelled) onSuccess(url);
    },
    (error: unknown) => {
      if (!cancelled) onError(error, errorMessageOf(error));
    },
  );

  return { cancel: () => (cancelled = true) };
};

/**
 * The dropzone's per-file upload handle already models progress, errors and the two query flavors;
 * this only mirrors its signals onto the callbacks. Reading them needs a reactive context, hence the
 * effect (destroyed with the run, so a cancelled upload stops reporting).
 */
const runQueryUpload = (
  options: Omit<StartImageUploadOptions, 'upload'> & { upload: AnyDropzoneUploadConfig<string> },
): RichTextEditorImageUploadRun => {
  const { file, upload, injector, onProgress, onSuccess, onError } = options;
  const handle = upload.createUploadHandle({ file, injector });
  let settled = false;

  const effectRef = effect(
    () => {
      const state = handle.state();
      const progress = handle.progress();

      untracked(() => {
        if (settled) return;

        if (state === 'uploading') {
          onProgress(progress);

          return;
        }

        settled = true;

        if (state === 'success') {
          const url = handle.value();

          if (url) onSuccess(url);
          else onError(null, null);

          return;
        }

        onError(handle.error(), handle.errorMessage());
      });
    },
    { injector },
  );

  handle.execute();

  return {
    cancel: () => {
      effectRef.destroy();
      handle.dispose();
    },
  };
};

/** Best-effort message for the failure callback - an `Error`, or a query error's own message. */
const errorMessageOf = (error: unknown): string | null => {
  if (error instanceof Error) return error.message;

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message;

    return typeof message === 'string' ? message : null;
  }

  return null;
};
