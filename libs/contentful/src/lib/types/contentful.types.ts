import { InputSignal, Type } from '@angular/core';
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

export type ComponentLikeWithAsset = Type<{
  asset: InputSignal<ContentfulRestAsset | ContentfulGqlAsset | null | undefined>;
}>;
export type ComponentLikeWithLink = Type<{
  href: InputSignal<string>;
  text: InputSignal<string>;
  marks?: InputSignal<readonly string[]>;
  richText?: InputSignal<boolean>;
}>;
export type ComponentLikeWithContentfulRendererInputs = Type<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields?: InputSignal<any>;

  includes?: InputSignal<ContentfulIncludeMap>;

  metadata?: InputSignal<ContentfulMetadata>;

  sys?: InputSignal<ContentfulEntrySys>;
}>;

export type ContentfulAssetComponents = {
  file?: ComponentLikeWithAsset;
  image?: ComponentLikeWithAsset;
  video?: ComponentLikeWithAsset;
  audio?: ComponentLikeWithAsset;
  link?: ComponentLikeWithLink;
};

export type ContentfulConfig = {
  /**
   * Components for rendering contentful assets and hyperlinks. Empty unless
   * `CONTENTFUL_DEFAULT_COMPONENTS` is spread into the config or a component is named here.
   */
  components: ContentfulAssetComponents;

  /**
   * Component for rendering embedded entries
   */
  customComponents: Record<string, ComponentLikeWithContentfulRendererInputs>;

  /**
   * Additional hostnames that should be treated as internal links (in addition to the current page's host).
   * Useful when the app runs on localhost during development but Contentful content references the production domain.
   * A configured hostname also covers its subdomains, so adding "example.com" treats
   * "foo.example.com" as internal without matching unrelated public-suffix siblings.
   *
   * @example ['example.com']
   */
  internalHosts: string[];

  /**
   * Default options for the contentful image api
   */
  imageOptions: {
    /**
     * Source set sizes. Eg.
     * - `"400"` - 400px width
     * - `"400x300"` - 400px width and 300px height
     * - `"400w"` - 400px width
     * - `"400h"` - 400px height (requires image dimensions to derive a valid width descriptor)
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
     * Background color for the image in hex. Eg. `"000000"` (a leading `#` is stripped)
     */
    backgroundColor: string | null;
  };
};

export type ContentfulConfigOptions = Partial<Omit<ContentfulConfig, 'imageOptions'>> & {
  /** Merged one level deep into the defaults, so a single option can be overridden. */
  imageOptions?: Partial<ContentfulConfig['imageOptions']>;
};

export type ContentfulLinkType = 'Space' | 'ContentType' | 'Environment' | 'Entry' | 'Asset' | 'Tag';
export type ContentfulLink<T extends ContentfulLinkType> = {
  type: 'Link';
  linkType: T;
  id: string;
};

export type ContentfulSpaceLink = ContentfulLink<'Space'>;
export type ContentfulEnvironmentLink = ContentfulLink<'Environment'>;
export type ContentfulContentTypeLink = ContentfulLink<'ContentType'>;
export type ContentfulEntryLink = ContentfulLink<'Entry'>;
export type ContentfulAssetLink = ContentfulLink<'Asset'>;
export type ContentfulTagLink = ContentfulLink<'Tag'>;

export type ContentfulTagLinkItem = {
  sys: ContentfulTagLink;
};

export type ContentfulEntryLinkItem = {
  sys: ContentfulEntryLink;
};

export type ContentfulAssetLinkItem = {
  sys: ContentfulAssetLink;
};

export type ContentfulMetadata = {
  tags: ContentfulTagLinkItem[];
};

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

export type ContentfulAssetImageData = {
  width: number;
  height: number;
};

export type ContentfulAssetFileData = {
  url: string | null;
  details: {
    size: number | null;
    image?: ContentfulAssetImageData;
  };
  fileName: string | null;
  contentType: string | null;
};

export type ContentfulRestAsset = {
  sys: ContentfulSys;
  fields: {
    title: string;
    description: string;
    file?: ContentfulAssetFileData;
  };
  metadata: ContentfulMetadata;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContentfulEntry<T = { [key: string]: any }> = {
  sys: ContentfulEntrySys;
  fields: T;
  metadata: ContentfulMetadata;
};

export type ContentfulCollection = {
  includes?: {
    Asset?: ContentfulRestAsset[];
    Entry?: ContentfulEntry[];
  };
  items: ContentfulEntry[];
  limit: number;
  skip: number;
  total: number;
  sys: {
    type: 'Array';
  };
};

export type RichTextResponse = {
  nodeType: 'document';
  data: NodeData;
  content: Block[];
};
