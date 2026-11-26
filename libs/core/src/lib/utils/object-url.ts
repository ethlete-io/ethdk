/** A `blob:` URL together with the only call that releases it again. See {@link createObjectUrlHandle}. */
export type ObjectUrlHandle = {
  /** The `blob:` URL, or `null` where there is no browser to mint one. */
  url: string | null;

  /** Releases the URL. Idempotent - a second call does nothing. */
  revoke: () => void;
};

/**
 * Creates an object URL for a `Blob`/`File` and hands back a handle that owns it. Keep the handle
 * for as long as the URL is on screen and call `revoke()` when it is not - the browser holds the
 * blob in memory until then.
 *
 * A handle rather than a bare string, so the URL and the call that frees it cannot drift apart. Use
 * `injectFileDownload()` instead when the URL only has to survive a single click.
 *
 * @example
 * const preview = createObjectUrlHandle(file);
 * // later
 * preview.revoke();
 */
export const createObjectUrlHandle = (object: Blob | MediaSource): ObjectUrlHandle => {
  const url = typeof URL === 'undefined' || !URL.createObjectURL ? null : URL.createObjectURL(object);

  let revoked = false;

  return {
    url,
    revoke: () => {
      if (!url || revoked) return;

      revoked = true;
      URL.revokeObjectURL(url);
    },
  };
};
