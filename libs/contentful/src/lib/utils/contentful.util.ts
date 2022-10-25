import { CONTENTFUL_CONFIG } from '../constants';
import { ContentfulConfig } from './contentful-config';

export const provideContentfulConfig = (contentfulConfig: ContentfulConfig) => {
  return { provide: CONTENTFUL_CONFIG, useValue: contentfulConfig };
};
