import { ComponentType } from '@angular/cdk/portal';
import { InputSignal } from '@angular/core';
import { Block, NodeData } from '@contentful/rich-text-types';
import { ContentfulIncludeMap } from '../components/rich-text-renderer';
import { ContentfulGqlAsset } from '../gql';

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

export type ComponentLikeWithAsset = ComponentType<{
  asset: InputSignal<ContentfulRestAsset | ContentfulGqlAsset | null | undefined>;
}>;
export type ComponentLikeWithContentfulRendererInputs = ComponentType<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields?: InputSignal<any>;

  includes?: InputSignal<ContentfulIncludeMap>;

  metadata?: InputSignal<ContentfulMetadata>;

  sys?: InputSignal<ContentfulEntrySys>;
}>;

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
  customComponents: Record<string, ComponentLikeWithContentfulRendererInputs>;

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

export type ContentfulLinkType = 'Space' | 'ContentType' | 'Environment' | 'Entry' | 'Asset' | 'Tag';
export interface ContentfulLink<T extends ContentfulLinkType> {
  type: 'Link';
  linkType: T;
  id: string;
}

export type ContentfulSpaceLink = ContentfulLink<'Space'>;
export type ContentfulEnvironmentLink = ContentfulLink<'Environment'>;
export type ContentfulContentTypeLink = ContentfulLink<'ContentType'>;
export type ContentfulEntryLink = ContentfulLink<'Entry'>;
export type ContentfulAssetLink = ContentfulLink<'Asset'>;
export type ContentfulTagLink = ContentfulLink<'Tag'>;

export interface ContentfulTagLinkItem {
  sys: ContentfulTagLink;
}

export interface ContentfulEntryLinkItem {
  sys: ContentfulEntryLink;
}

export interface ContentfulAssetLinkItem {
  sys: ContentfulAssetLink;
}

export interface ContentfulMetadata {
  tags: ContentfulTagLinkItem[];
}

export type ContentfulSys = {
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
};

export type ContentfulEntrySys = ContentfulSys & {
  contentType: {
    sys: ContentfulContentTypeLink;
  };
};

export interface ContentfulAssetImageData {
  width: number;
  height: number;
}

export interface ContentfulAssetFileData {
  url: string | null;
  details: {
    size: number | null;
    image?: ContentfulAssetImageData;
  };
  fileName: string | null;
  contentType: string | null;
}

export interface ContentfulRestAsset {
  sys: ContentfulSys;
  fields: {
    title: string;
    description: string;
    file: ContentfulAssetFileData;
  };
  metadata: ContentfulMetadata;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ContentfulEntry<T = { [key: string]: any }> {
  sys: ContentfulEntrySys;
  fields: T;
  metadata: ContentfulMetadata;
}

export interface ContentfulCollection {
  includes: {
    Asset: ContentfulRestAsset[];
    Entry: ContentfulEntry[];
  };
  items: ContentfulEntry[];
  limit: number;
  skip: number;
  total: number;
  sys: {
    type: 'Array';
  };
}

export interface RichTextResponse {
  nodeType: 'document';
  data: NodeData;
  content: Block[];
}
