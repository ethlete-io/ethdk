import { InferMimeTypePipe } from '@ethlete/core';
import { PictureSource } from '../../picture.component.types';

export const normalizeSource = (source: string | PictureSource) => {
  const inferMimeType = new InferMimeTypePipe();

  if (typeof source === 'string') {
    return { type: inferMimeType.transform(source) ?? '', srcset: source } as PictureSource;
  } else {
    const mimeType = source.type && source.type !== '' ? source.type : inferMimeType.transform(source.srcset);
    return { type: mimeType ?? '', srcset: source.srcset } as PictureSource;
  }
};
