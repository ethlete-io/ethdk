import { gql } from '@ethlete/query';

export const GQL_FRAGMENT_CONTENTFUL_ASSET = gql`
  fragment AssetData on Asset {
    sys {
      id
    }
    url
    title
    width
    height
    description
    contentType
    size
  }
`;

export interface ContentfulGqlAsset {
  sys: {
    id: string;
  };
  title: string | null;
  contentType: string | null;
  url: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  size: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isContentfulGqlAsset = (asset: any): asset is ContentfulGqlAsset => {
  return asset?.sys?.id && asset?.url && typeof asset?.size === 'number';
};

export type ContentfulGqlWhereFilter<TLinkedFrom extends Record<string, unknown> = Record<string, unknown>> = {
  /**
   * Filer by ids.
   * @see https://www.contentful.com/developers/docs/references/graphql/#/reference/collection-filters/sys-filters
   */
  sys?: {
    id?: string;
    id_not?: string;
    id_in?: string[];
    id_not_in?: string[];
    id_contains?: string;
    id_not_contains?: string;
  };
  /**
   * Filer by tags.
   * @see https://www.contentful.com/developers/docs/references/graphql/#/reference/collection-filters/contentfulmetadata-filters
   */
  contentfulMetadata?: {
    tags_exists?: boolean;
    tags?: {
      id_contains_some?: string[];
      id_contains_none?: string[];
      id_contains_all?: string[];
    };
  };
  /**
   * Retrieve a collection of entries linked to the specified entry or asset.
   * @see https://www.contentful.com/developers/docs/references/graphql/#links-to-a-specific-item
   */
  linkedFrom?: TLinkedFrom;
};

export type ContentfulGqlOrder = `${string}_${'ASC' | 'DESC'}`;

export type ContentfulGqlCollectionFilterVariables<
  TCustomWhere extends Record<string, unknown> = Record<string, unknown>,
  TLinkedFrom extends Record<string, unknown> = Record<string, unknown>,
> = {
  /**
   * Zero-indexed offset in the collection from which items are fetched
   * @default 0
   */
  skip?: number;

  /**
   * Maximum number of items to fetch. Maximum is 1000.
   * @default 100
   */
  limit?: number;

  /**
   * Filter specifications to apply on the collection query.
   * @see https://www.contentful.com/developers/docs/references/graphql/#/reference/collection-filters
   */
  where?: TCustomWhere & ContentfulGqlWhereFilter<TLinkedFrom>;

  /**
   * Order specifications to apply on the collection query.
   * @see https://www.contentful.com/developers/docs/references/graphql/#/reference/collection-order
   */
  order?: ContentfulGqlOrder[];

  /**
   * When set to `true` the field will be resolved with non published content.
   * @default false
   */
  preview?: boolean;

  /**
   * Locale for the collection items. If not set the default locale is used.
   */
  locale?: string;
};
