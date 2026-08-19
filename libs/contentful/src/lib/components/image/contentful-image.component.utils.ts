import { PictureSource } from '@ethlete/components';
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
  const widthAndHeight = /^(\d+)w?x(\d+)h?$/.exec(size);

  if (widthAndHeight) {
    return {
      width: Number(widthAndHeight[1]),
      height: Number(widthAndHeight[2]),
    };
  }

  const height = /^(\d+)h$/.exec(size);

  if (height) {
    return { width: null, height: Number(height[1]) };
  }

  const width = /^(\d+)w?$/.exec(size);

  return width ? { width: Number(width[1]), height: null } : { width: null, height: null };
};

const SOURCE_TYPES = ['image/avif', 'image/webp'];

export const generateContentfulImageSources = (
  data: ContentfulRestAsset | ContentfulGqlAsset,
  srcsetSizes: string[],
  backgroundColor: string | null,
  quality: number | null,
  focusArea: ContentfulImageFocusArea | null,
  resizeBehavior: ContentfulImageResizeBehavior | null,
): PictureSource[] => {
  const isGqlAsset = isContentfulGqlAsset(data);
  const baseUrl = isGqlAsset ? data.url : data.fields.file.url;

  if (!baseUrl) {
    return [];
  }

  const imageDimensions = isGqlAsset ? data : data.fields.file.details.image;
  const sources: PictureSource[] = [];

  for (const type of SOURCE_TYPES) {
    const sourceSets: string[] = [];
    const queryParams: string[] = [];

    queryParams.push(`fm=${type.split('/')[1]}`);

    if (backgroundColor) {
      queryParams.push(`bg=rgb:${backgroundColor}`);
    }

    if (quality !== null && Number.isFinite(quality)) {
      queryParams.push(`q=${quality}`);
    }

    if (focusArea) {
      queryParams.push(`f=${focusArea}`);
    }

    if (resizeBehavior) {
      queryParams.push(`fit=${resizeBehavior}`);
    }

    if (srcsetSizes?.length) {
      const urlWithParams = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${queryParams.join('&')}`;

      for (const size of srcsetSizes) {
        const { width, height } = parseContentfulImageSize(size);

        if (width && height) {
          sourceSets.push(`${urlWithParams}&w=${width}&h=${height} ${width}w`);
        } else if (width) {
          sourceSets.push(`${urlWithParams}&w=${width} ${width}w`);
        } else if (height && imageDimensions?.width && imageDimensions.height) {
          const derivedWidth = Math.round((height * imageDimensions.width) / imageDimensions.height);
          sourceSets.push(`${urlWithParams}&w=${derivedWidth}&h=${height} ${derivedWidth}w`);
        }
      }
    }

    sources.push({
      type,
      srcset: sourceSets.length
        ? sourceSets.join(', ')
        : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${queryParams.join('&')}`,
    });
  }

  return sources;
};
