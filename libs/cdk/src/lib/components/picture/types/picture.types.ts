/**
 * A source to be used in a picture element.
 * @see https://www.mediaevent.de/html/picture.html
 * @see https://web.dev/learn/design/responsive-images
 */
export interface PictureSource {
  /**
   * The mime type of the image.
   * If not provided, it will be inferred from the URL.
   * If it cannot be inferred, it will be `null` and a error will be logged to the console without throwing.
   * @example `image/jpeg`
   */
  type?: string | null;

  /**
   * The source set of the image. Can be either a single URL or a comma-separated list of URLs.
   * If a width descriptor is provided (eg. 200w), you must also set the `sizes` property.
   * If a density descriptor is provided (eg. 2x), the browser will automatically select the correct image based on the device's pixel density.
   *
   * **Note**: You can provide either a width descriptor or a density descriptor, but not both.
   * @example `https://example.com/image.jpg`
   * @example `https://example.com/image.jpg 1x, https://example.com/image@2x.jpg 2x`
   * @example `https://example.com/image.jpg 300w, https://example.com/image600.jpg 600w`
   */
  srcset: string;

  /**
   * The sizes attribute of the image.
   *
   * **Note**: Only required if the `srcset` property contains width descriptors.
   * @example `100vw` // The image will take up the full width of the viewport
   * @example `(min-width: 800px) 50vw, 100vw` // The image will take up 50% of the viewport width if the viewport is at least 800px wide, otherwise it will take up the full width
   */
  sizes?: string | null;

  /**
   * The media query to which the source applies.
   * If the media query applies, the source will be used.
   * @example `(min-width: 800px)` // Only applies if the viewport is at least 800px wide
   * @example `(min-width: 800px) and (orientation: landscape) and (prefers-color-scheme: dark)` // Only applies if the viewport is at least 800px wide, is in landscape orientation and prefers dark colors
   */
  media?: string | null;
}

export interface PictureConfig {
  baseUrl?: string;
}
