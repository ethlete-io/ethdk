import { ComponentType } from '@angular/cdk/portal';
import { Block, Document as ContentfulDocument, NodeData } from '@contentful/rich-text-types';

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
  priority?: boolean;
  __typename: string;
}

export type ContentfulImageResizeBehavior = 'pad' | 'crop' | 'fill' | 'scale' | 'thumb' | 'fit';
export type ContentfulImageFocusArea =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'center'
  | 'top_left'
  | 'top_right'
  | 'bottom_left'
  | 'bottom_right'
  | 'face'
  | 'faces';

export interface ContentfulImage {
  sys: {
    id: string;
  };
  asset: ContentfulAsset;
  alt: string | null;
  caption: string | null;
  resizeBehavior: ContentfulImageResizeBehavior | null;
  focusArea: ContentfulImageFocusArea | null;
  quality: number;
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

type ComponentLikeWithAsset = ComponentType<{ data: ContentfulAsset | ContentfulImage | null | undefined }>;

export interface ContentfulAssetComponents {
  file: ComponentLikeWithAsset;
  image: ComponentLikeWithAsset;
  video: ComponentLikeWithAsset;
  audio: ComponentLikeWithAsset;
}

export interface ContentfulConfig {
  /**
   * Default components for rendering contentful assets
   */
  components: ContentfulAssetComponents;

  /**
   * Component for rendering embedded entries
   */
  customComponents: Record<string, ComponentType<unknown>>;

  /**
   * Determines if the contentful rich text renderer should render the contentful rich text with tailwind css classes
   */
  useTailwindClasses: boolean;

  /**
   * Default options for the contentful image api
   */
  imageOptions: {
    /**
     * Source set sizes. Eg.
     * - `"400"` - 400px width
     * - `"400x300"` - 400px width and 300px height
     * - `"400w"` - 400px width
     * - `"400h"` - 400px height
     * - `"400wx300h"` - 400px width and 300px height
     **/
    srcsetSizes: string[];

    /**
     * Sizes for the image. Eg.
     *  - `"100vw"` - 100% of the viewport width
     *  - `"50vw"` - 50% of the viewport width
     *  - `(min-width: 30em) 30em"` - 30em if the viewport is at least 30em wide
     */
    sizes: string[];

    /**
     * Background color for the image in hex. Eg. `"000000"`
     */
    backgroundColor: string | null;
  };
}

export type ContentfulLinkType = 'Space' | 'ContentType' | 'Environment';
export interface ContentfulLink<T extends ContentfulLinkType> {
  type: 'Link';
  linkType: T;
  id: string;
}

export type ContentfulSpaceLink = ContentfulLink<'Space'>;
export type ContentfulEnvironmentLink = ContentfulLink<'Environment'>;
export type ContentfulContentTypeLink = ContentfulLink<'ContentType'>;

interface ContentfulTagLink {
  sys: {
    type: 'Link';
    linkType: 'Tag';
    id: string;
  };
}

interface ContentfulMetadata {
  tags: ContentfulTagLink[];
}

export interface ContentfulSys {
  type: string;
  id: string;
  createdAt: string;
  updatedAt: string;
  locale: string;
  revision?: number;
  space?: {
    sys: ContentfulSpaceLink;
  };
  environment?: {
    sys: ContentfulEnvironmentLink;
  };
  contentType: {
    sys: ContentfulContentTypeLink;
  };
}

interface ContentfulAssetImageData {
  width: number;
  height: number;
}

interface ContentfulAssetFileData {
  url: string;
  details: {
    size: number;
    image?: ContentfulAssetImageData;
  };
  fileName: string;
  contentType: string;
}

export interface ContentfulAssetNew {
  sys: ContentfulSys;
  fields: {
    title: string;
    description: string;
    file: ContentfulAssetFileData;
  };
  metadata: ContentfulMetadata;
}

export interface ContentfulEntryNew<T = Record<string, unknown>> {
  sys: ContentfulSys;
  fields: T;
  metadata: ContentfulMetadata;
}

export interface ContentfulCollection {
  includes: {
    Asset: ContentfulAssetNew[];
    Entry: ContentfulEntryNew[];
  };
  items: ContentfulEntryNew[];
  limit: number;
  skip: number;
  total: number;
  sys: {
    type: 'Array';
  };
}

export interface RichTextResponseNew {
  nodeType: 'document';
  data: NodeData;
  content: Block[];
}
