import { CONTENTFUL_CONFIG } from '../constants';
import { ContentfulAsset, ContentfulConfig, ContentfulImage } from '../types';
import { createContentfulConfig } from './contentful-config';

export const provideContentfulConfig = (contentfulConfig: Partial<ContentfulConfig> | null | undefined = {}) => {
  return { provide: CONTENTFUL_CONFIG, useValue: createContentfulConfig(contentfulConfig) };
};

export const isContentfulImage = (v: ContentfulAsset | ContentfulImage | null | undefined): v is ContentfulImage => {
  return !!v && 'asset' in v && 'alt' in v && 'resizeBehavior' in v && 'focusArea' in v;
};

export const isContentfulAsset = (v: ContentfulAsset | ContentfulImage | null | undefined): v is ContentfulAsset => {
  return !!v && 'contentType' in v && 'description' in v && 'height' in v && 'url' in v && 'width' in v;
};
