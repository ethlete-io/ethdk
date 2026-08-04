import { InjectionToken } from '@angular/core';
import { inferMimeType } from '@ethlete/core';
import { PictureConfig, PictureSource } from '../types/picture.types';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const IMAGE_CONFIG_TOKEN = new InjectionToken<PictureConfig>('IMAGE_CONFIG_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const provideImageConfig = (config: Partial<PictureConfig> | null | undefined = {}) => {
  return {
    provide: IMAGE_CONFIG_TOKEN,
    useValue: config,
  };
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const extractFirstImageUrl = (source: string | PictureSource | null): string | null => {
  const srcString = typeof source === 'string' ? source : source?.srcset;

  if (!srcString) return null;

  if (srcString.trimStart().startsWith('data:')) {
    return srcString.trim() || null;
  }

  const srcsetParts = srcString.split(',').map((part) => part.trim());

  if (srcsetParts.length > 0) {
    const firstPart = srcsetParts[0];
    const url = firstPart?.split(' ')[0] || null;
    return url;
  }

  return null;
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const normalizePictureSource = (source: string | PictureSource) => {
  if (typeof source === 'string') {
    return { type: inferMimeType(source), srcset: source, media: null, sizes: null } as PictureSource;
  } else {
    const mimeType = source.type && source.type !== '' ? source.type : inferMimeType(source.srcset);

    if (!mimeType) {
      console.error(`Could not infer mime type for srcset: ${source.srcset}. Please provide a type.`);
    }

    return { type: mimeType, srcset: source.srcset, media: source.media, sizes: source.sizes } as PictureSource;
  }
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const normalizePictureSizes = (sizes: string | string[] | null) => {
  if (!sizes) {
    return null;
  }

  if (Array.isArray(sizes)) {
    return sizes.join(', ');
  }

  return sizes;
};
