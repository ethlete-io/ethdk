import { PictureSource } from '@ethlete/cdk';
import { ContentfulGqlAsset, isContentfulGqlAsset } from '../../gql';
import { ContentfulImageFocusArea, ContentfulImageResizeBehavior, ContentfulRestAsset } from '../../types';

export const generateDefaultContentfulImageSource = (data: ContentfulRestAsset | ContentfulGqlAsset): PictureSource => {
  if (isContentfulGqlAsset(data)) {
    if (!data.contentType || !data.url) {
      return {
        type: '',
        srcset: '',
      };
    }

    return {
      type: data.contentType,
      srcset: data.url,
    };
  }

  if (!data.fields.file.contentType || !data.fields.file.url) {
    return {
      type: '',
      srcset: '',
    };
  }

  return {
    type: data.fields.file.contentType,
    srcset: data.fields.file.url,
  };
};

/**
 * Parses source set sizes into an object containing with and height. Eg.
 * - `"400"` - 400px width
 * - `"400x300"` - 400px width and 300px height
 * - `"400w"` - 400px width
 * - `"400h"` - 400px height
 * - `"400wx300h"` - 400px width and 300px height
 **/
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

export const generateContentfulImageSources = (
  data: ContentfulRestAsset | ContentfulGqlAsset,
  srcsetSizes: string[],
  backgroundColor: string | null,
  quality: number | null,
  focusArea: ContentfulImageFocusArea | null,
  resizeBehavior: ContentfulImageResizeBehavior | null,
): PictureSource[] => {
  const assetData = data;

  if (!assetData) {
    return [];
  }

  const sources: PictureSource[] = [];

  const SOURCE_TYPES = ['image/avif', 'image/webp', 'image/png', 'image/jpg'];

  for (const type of SOURCE_TYPES) {
    const baseUrl = isContentfulGqlAsset(assetData) ? assetData.url : assetData.fields.file.url;
    const sourceSets: string[] = [];
    const queryParams: string[] = [];

    // Set the format (e.g. 'fm=webp')
    queryParams.push(`fm=${type.split('/')[1]}`);

    if (backgroundColor) {
      queryParams.push(`bg=rgb:${backgroundColor}`);
    }

    if (quality !== null) {
      queryParams.push(`q=${quality}`);
    }

    if (focusArea) {
      queryParams.push(`f=${focusArea}`);
    }

    if (resizeBehavior) {
      queryParams.push(`fit=${resizeBehavior}`);
    }
    if (srcsetSizes?.length) {
      const urlWithParams = `${baseUrl}?${queryParams.join('&')}`;

      for (const size of srcsetSizes) {
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

  return sources;
};
