import { PictureSource } from '@ethlete/components';
import { ContentfulAsset, ContentfulImage } from '../../types';
import { isContentfulImage } from '../../utils';

export const generateDefaultContentfulImageSource = (data: ContentfulAsset): PictureSource => {
  const { url, contentType } = data;

  return {
    type: contentType,
    srcset: url,
  };
};

// The size string can have the following formats:
// - '100w' - width 100
// - '100h' - height 100
// - '100wx100h' - width 100, height 100
// - '100' - width 100
// - '100x100' - width 100, height 100
export const parseContentfulImageSize = (size: string): { width: number | null; height: number | null } => {
  let width: string | null | undefined = null;
  let height: string | null | undefined = null;

  if (size.includes('x')) {
    const [w, h] = size.split('x');

    width = w;
    height = h;
  } else if (size.includes('h')) {
    height = size;
  } else {
    width = size;
  }

  return {
    width: width ? parseInt(width, 10) : null,
    height: height ? parseInt(height, 10) : null,
  };
};

export const generateContentfulImageSources = (data: ContentfulAsset | ContentfulImage): PictureSource[] => {
  const assetData = isContentfulImage(data) ? data.asset : data;
  const imageData = isContentfulImage(data) ? data : null;

  if (!assetData) {
    return [];
  }

  const sources: PictureSource[] = [];

  const SOURCE_TYPES = ['image/avif', 'image/webp', 'image/png', 'image/jpeg'];

  for (const type of SOURCE_TYPES) {
    const baseUrl = assetData.url;
    const sourceSets: string[] = [];
    const queryParams: string[] = [];

    // Set the format (e.g. 'fm=webp')
    queryParams.push(`fm=${type.split('/')[1]}`);

    if (imageData) {
      if (imageData.backgroundColor) {
        queryParams.push(`bg=rgb:${imageData.backgroundColor}`);
      }

      if (imageData.quality) {
        queryParams.push(`q=${imageData.quality}`);
      }

      if (imageData.focusArea) {
        queryParams.push(`f=${imageData.focusArea}`);
      }

      if (imageData.resizeBehavior) {
        queryParams.push(`fit=${imageData.resizeBehavior}`);
      }

      if (imageData.srcsetSizes?.length) {
        const urlWithParams = `${baseUrl}?${queryParams.join('&')}`;

        for (const size of imageData.srcsetSizes) {
          const { width, height } = parseContentfulImageSize(size);

          if (width && height) {
            sourceSets.push(`${urlWithParams}&w=${width}&h=${height} ${width}w`);
          } else if (width) {
            sourceSets.push(`${urlWithParams}&w=${width} ${width}w`);
          } else if (height) {
            sourceSets.push(`${urlWithParams}&h=${height} ${height}h`);
          }
        }
      }

      sources.push({
        type,
        srcset: sourceSets.length ? sourceSets.join(', ') : `${baseUrl}?${queryParams.join('&')}`,
      });
    }
  }

  return sources;
};
