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

export const GQL_FRAGMENT_CONTENTFUL_IMAGE = gql`
  fragment ImageData on Image {
    sys {
      id
    }
    asset {
      ...AssetData
    }
    srcsetSizes
    sizes
    alt
    caption
    resizeBehavior
    focusArea
    quality
    backgroundColor
    __typename
  }
`;
