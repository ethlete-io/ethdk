import { Document as ContentfulDocument } from '@contentful/rich-text-types';

export interface ContentfulAsset {
  sys: {
    id: string;
  };
  title: string;
  contentType: string;
  url: string;
  description: string | null;
  width: number | null;
  height: number | null;
  size: number;
  __typename: string;
}

export interface RichTextResponse {
  json: ContentfulDocument;
  links: {
    assets?: {
      block?: Array<ContentfulAsset>;
      inline?: Array<ContentfulAsset>;
    };
    entries?: {
      block?: Array<ContentfulEntryBase>;
      inline?: Array<ContentfulEntryBase>;
    };
  };
}

export interface ContentfulEntryBase {
  sys: { id: string };
  __typename: string;
}
