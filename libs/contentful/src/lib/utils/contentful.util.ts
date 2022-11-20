import { CONTENTFUL_CONFIG } from '../constants';
import { ContentfulConfig } from '../types';
import { createContentfulConfig } from './contentful-config';

export const provideContentfulConfig = (contentfulConfig: Partial<ContentfulConfig> | null | undefined = {}) => {
  return { provide: CONTENTFUL_CONFIG, useValue: createContentfulConfig(contentfulConfig) };
};
