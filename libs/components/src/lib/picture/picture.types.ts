/**
 * One candidate set for a `<picture>`, i.e. one `<source>` element.
 *
 * @see https://web.dev/learn/design/responsive-images
 */
export type PictureSource = {
  /**
   * The image's mime type, e.g. `image/webp`. Inferred from the URL when omitted; a URL it can't be
   * inferred from logs an error in dev mode rather than throwing, since the browser copes without it.
   */
  type?: string | null;

  /**
   * A single URL, or a comma-separated candidate list with descriptors.
   *
   * With **width** descriptors (`400w`) you must also give `sizes`, or the browser has no way to know how
   * much of the viewport the image will occupy. With **density** descriptors (`2x`) you must not — the
   * browser picks by device pixel ratio. The two forms can't be mixed in one srcset.
   *
   * @example 'https://example.com/hero.jpg'
   * @example 'https://example.com/hero.jpg 1x, https://example.com/hero@2x.jpg 2x'
   * @example 'https://example.com/hero-400.jpg 400w, https://example.com/hero-800.jpg 800w'
   */
  srcset: string;

  /**
   * How much space the image will take, so the browser can pick a candidate before it has laid the page
   * out. Only meaningful alongside width descriptors. Falls back to the picture's own `sizes`.
   *
   * @example '100vw'
   * @example '(min-width: 800px) 50vw, 100vw'
   */
  sizes?: string | null;

  /**
   * The media query this source applies to — this is what makes art direction possible, as opposed to
   * merely picking a resolution.
   *
   * @example '(min-width: 800px)'
   * @example '(orientation: portrait)'
   */
  media?: string | null;
};

export type PictureConfig = {
  /**
   * Prefixed onto every relative `srcset` entry, so sources can be authored as API paths. Absolute URLs
   * and `data:` URIs are left alone.
   */
  baseUrl?: string;
};

/** Where the `<img>` has got to. `'loading'` until the browser reports either way. */
export const PICTURE_STATES = {
  LOADING: 'loading',
  LOADED: 'loaded',
  ERROR: 'error',
} as const;

export type PictureState = (typeof PICTURE_STATES)[keyof typeof PICTURE_STATES];
