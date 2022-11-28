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
}

export interface RichTextResponse {
  json: ContentfulDocument;
  links: {
    assets: {
      block: Array<ContentfulAsset>;
    };
  };
}
