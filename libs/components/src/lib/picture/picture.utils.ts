import { inferMimeType } from '@ethlete/core';
import { PictureConfig, PictureSource } from './picture.types';

/**
 * The first URL out of a srcset, for the `<img src>` fallback a `<picture>` still needs - a browser that
 * matches no `<source>` (or doesn't support `<picture>` at all) loads the `img`.
 *
 * Descriptors are stripped, and a `data:` URI is returned whole rather than split on its commas - base64
 * payloads contain them, so treating one as a candidate list would truncate the image.
 */
export const extractFirstImageUrl = (source: string | PictureSource | null): string | null => {
  const srcset = typeof source === 'string' ? source : source?.srcset;

  if (!srcset) return null;

  if (srcset.trimStart().startsWith('data:')) {
    return srcset.trim() || null;
  }

  const firstCandidate = srcset.split(',')[0]?.trim();

  return firstCandidate?.split(' ')[0] || null;
};

/**
 * A source in its full form, with the mime type filled in from the URL where it wasn't given. The type is
 * what lets a browser skip a `<source>` it can't decode without downloading it, so it is worth inferring -
 * but a URL that carries no extension (a signed CDN URL, an API endpoint) can't be inferred from, which
 * warns in dev rather than throwing: the browser will simply try the source.
 */
export const normalizePictureSource = (source: string | PictureSource): PictureSource => {
  if (typeof source === 'string') {
    return { type: inferMimeType(source), srcset: source, media: null, sizes: null };
  }

  const type = source.type || inferMimeType(source.srcset);

  if (!type && ngDevMode) {
    console.warn(
      `[et-picture] Could not infer a mime type from srcset "${source.srcset}". ` +
        'Pass `type` explicitly so browsers can skip formats they cannot decode.',
    );
  }

  return { type, srcset: source.srcset, media: source.media ?? null, sizes: source.sizes ?? null };
};

/** `sizes` as the attribute wants it. An array is the readable way to author one, so both forms are taken. */
export const normalizePictureSizes = (sizes: string | string[] | null | undefined): string | null => {
  if (!sizes) return null;

  return Array.isArray(sizes) ? sizes.join(', ') || null : sizes;
};

/**
 * A single URL prefixed with the base, unless it is already absolute or a data URI. Exactly one slash joins
 * them however each side is written - cdk produced `host//path` when both carried one.
 */
const withBaseUrl = (url: string, baseUrl: string) => {
  if (url.startsWith('http') || url.startsWith('data:')) return url;

  return `${baseUrl.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
};

/**
 * A source with the configured `baseUrl` applied, so sources can be authored as the paths an API returns.
 *
 * Applied **per candidate**, which is what makes a relative multi-candidate srcset work: cdk prefixed the
 * srcset as one string, so `'a.jpg 1x, b.jpg 2x'` left the second candidate unresolved. A `data:` URI is
 * passed through whole - its base64 payload contains commas, so it is not a candidate list.
 */
export const withPictureBaseUrl = (source: PictureSource, config: PictureConfig | null): PictureSource => {
  const baseUrl = config?.baseUrl;

  if (!baseUrl || source.srcset.trimStart().startsWith('data:')) return source;

  const srcset = source.srcset
    .split(',')
    .map((candidate) => {
      const [url, ...descriptors] = candidate.trim().split(/\s+/);

      if (!url) return null;

      return [withBaseUrl(url, baseUrl), ...descriptors].join(' ');
    })
    .filter((candidate): candidate is string => candidate !== null)
    .join(', ');

  return { ...source, srcset };
};
