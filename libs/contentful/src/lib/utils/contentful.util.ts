import { CONTENTFUL_CONFIG } from '../constants';
import { ContentfulConfig, ContentfulEntry } from '../types';
import { createContentfulConfig } from './contentful-config';

export const provideContentfulConfig = (contentfulConfig: Partial<ContentfulConfig> | null | undefined = {}) => {
  return { provide: CONTENTFUL_CONFIG, useValue: createContentfulConfig(contentfulConfig) };
};

export const isContentfulEntryType = <T extends ContentfulEntry>(entry: ContentfulEntry, type: string): entry is T =>
  entry.sys.contentType.sys.id === type;
