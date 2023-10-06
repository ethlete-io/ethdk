import { inferMimeType } from '@ethlete/core';
import { PictureSource } from '../../picture.component.types';

export const normalizeSource = (source: string | PictureSource) => {
  if (typeof source === 'string') {
    return { type: inferMimeType(source), srcset: source } as PictureSource;
  } else {
    const mimeType = source.type && source.type !== '' ? source.type : inferMimeType(source.srcset);
    return { type: mimeType, srcset: source.srcset } as PictureSource;
  }
};
