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
