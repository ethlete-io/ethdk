import { ComponentType } from '@angular/cdk/portal';
import { InputSignal } from '@angular/core';
import { Block, NodeData } from '@contentful/rich-text-types';
import { ContentfulIncludeMap } from '../components/rich-text-renderer';

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

type ComponentLikeWithAsset = ComponentType<{ asset: InputSignal<ContentfulAsset | null | undefined> }>;
type ComponentLikeWithContentfulRendererInputs = ComponentType<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields?: InputSignal<any>;

  includes?: InputSignal<ContentfulIncludeMap>;

  metadata?: InputSignal<ContentfulMetadata>;

  sys?: InputSignal<ContentfulSys>;
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

export type ContentfulLinkType = 'Space' | 'ContentType' | 'Environment';
export interface ContentfulLink<T extends ContentfulLinkType> {
  type: 'Link';
  linkType: T;
  id: string;
}

export type ContentfulSpaceLink = ContentfulLink<'Space'>;
export type ContentfulEnvironmentLink = ContentfulLink<'Environment'>;
export type ContentfulContentTypeLink = ContentfulLink<'ContentType'>;

export interface ContentfulTagLink {
  sys: {
    type: 'Link';
    linkType: 'Tag';
    id: string;
  };
}

export interface ContentfulMetadata {
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

export interface ContentfulAssetImageData {
  width: number;
  height: number;
}

export interface ContentfulAssetFileData {
  url: string;
  details: {
    size: number;
    image?: ContentfulAssetImageData;
  };
  fileName: string;
  contentType: string;
}

export interface ContentfulAsset {
  sys: ContentfulSys;
  fields: {
    title: string;
    description: string;
    file: ContentfulAssetFileData;
  };
  metadata: ContentfulMetadata;
}

export interface ContentfulEntry<T = Record<string, unknown>> {
  sys: ContentfulSys;
  fields: T;
  metadata: ContentfulMetadata;
}

export interface ContentfulCollection {
  includes: {
    Asset: ContentfulAsset[];
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
