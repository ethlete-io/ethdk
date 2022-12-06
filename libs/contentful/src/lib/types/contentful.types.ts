import { ComponentType } from '@angular/cdk/portal';
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
  srcsetSizes: string[];
  sizes: string[];
  alt: string | null;
  caption: string | null;
  resizeBehavior: ContentfulImageResizeBehavior | null;
  focusArea: ContentfulImageFocusArea | null;
  quality: number;
  backgroundColor: string | null;
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
}
