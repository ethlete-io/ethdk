import { Provider } from '@angular/core';
import { CONTENTFUL_CONFIG } from '../constants';
import { ContentfulConfigOptions, ContentfulEntry } from '../types';
import { createContentfulConfig } from './contentful-config';

export const provideContentfulConfig = (contentfulConfig?: ContentfulConfigOptions | null): Provider => {
  return { provide: CONTENTFUL_CONFIG, useValue: createContentfulConfig(contentfulConfig) };
};

export const isContentfulEntryType = <T extends ContentfulEntry>(entry: ContentfulEntry, type: string): entry is T =>
  entry.sys.contentType.sys.id === type;
