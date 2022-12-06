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
  // srcsetSizes: string[];
  // sizes: string[];
  alt: string | null;
  caption: string | null;
  resizeBehavior: ContentfulImageResizeBehavior | null;
  focusArea: ContentfulImageFocusArea | null;
  quality: number;
  // backgroundColor: string | null;
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
