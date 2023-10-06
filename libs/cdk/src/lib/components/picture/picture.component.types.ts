export interface PictureSource {
  /**
   * The mime type of the image.
   * @example `image/jpeg`
   */
  type: string | null;

  /**
   * The source set of the image. Can be either a single URL or a comma-separated list of URLs.
   * @example `https://example.com/image.jpg`
   * @example `https://example.com/image.jpg, https://example.com/image@2x.jpg`
   */
  srcset: string;
}

export interface PictureConfig {
  baseUrl?: string;
}
