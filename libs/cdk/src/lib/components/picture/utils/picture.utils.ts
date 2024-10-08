import { InjectionToken } from '@angular/core';
import { inferMimeType } from '@ethlete/core';
import { PictureConfig, PictureSource } from '../types/picture.types';

export const IMAGE_CONFIG_TOKEN = new InjectionToken<PictureConfig>('IMAGE_CONFIG_TOKEN');

export const provideImageConfig = (config: Partial<PictureConfig> | null | undefined = {}) => {
  return {
    provide: IMAGE_CONFIG_TOKEN,
    useValue: config,
  };
};

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

export const normalizePictureSizes = (sizes: string | string[] | null) => {
  if (!sizes) {
    return null;
  }

  if (Array.isArray(sizes)) {
    return sizes.join(', ');
  }

  return sizes;
};
