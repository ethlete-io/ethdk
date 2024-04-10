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
  title: string;
  contentType: string;
  url: string;
  description: string | null;
  width: number | null;
  height: number | null;
  size: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isContentfulGqlAsset = (asset: any): asset is ContentfulGqlAsset => {
  return asset?.sys?.id && asset?.url && typeof asset?.size === 'number';
};
